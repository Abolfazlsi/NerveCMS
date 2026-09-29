from django.db import transaction
from django.utils import timezone

from inventory.models import StockMovement
from sales.models import SalesReturn, Order


@transaction.atomic
def complete_sales_return(sales_return):
    sales_return = (
        SalesReturn.objects
        .select_for_update()
        .prefetch_related("items__product")
        .get(pk=sales_return.pk)
    )

    if sales_return.status == SalesReturn.COMPLETED:
        raise ValueError("این مرجوعی قبلاً تکمیل شده است.")

    if sales_return.status == SalesReturn.CANCELLED:
        raise ValueError("این مرجوعی لغو شده و قابل تکمیل نیست.")

    if not sales_return.items.exists():
        raise ValueError("مرجوعی نمی‌تواند بدون محصول باشد.")

    for item in sales_return.items.all():
        StockMovement.objects.create(
            business=sales_return.business,
            product=item.product,
            warehouse=sales_return.warehouse,
            movement_type=StockMovement.IN,
            quantity=item.quantity,
            reason=f"مرجوعی سفارش {sales_return.order.order_number}",
            created_by=sales_return.created_by,
        )

    sales_return.status = SalesReturn.COMPLETED
    sales_return.completed_at = timezone.now()

    sales_return.save(
        update_fields=["status", "completed_at"]
    )

    return sales_return


@transaction.atomic
def change_order_status(order, new_status):
    order = (
        Order.objects
        .select_for_update()
        .get(pk=order.pk)
    )

    transitions = {
        Order.DRAFT: {
            Order.PENDING,
            Order.CANCELLED,
        },
        Order.PENDING: {
            Order.PAID,
            Order.CANCELLED,
        },
        Order.PAID: {
            Order.FULFILLED,
        },
        Order.FULFILLED: set(),
        Order.CANCELLED: set(),
    }

    allowed_statuses = transitions.get(order.status, set())

    if new_status not in allowed_statuses:
        raise ValueError(
            f"تغییر وضعیت از «{order.get_status_display()}» "
            f"به وضعیت جدید مجاز نیست."
        )

    order.status = new_status
    order.save(update_fields=["status", "updated_at"])

    return order


@transaction.atomic
def confirm_order(order):
    order = (
        Order.objects
        .select_for_update()
        .prefetch_related("items__product")
        .get(pk=order.pk)
    )

    if order.status != Order.DRAFT:
        raise ValueError(
            "فقط سفارش‌های پیش‌نویس قابل تأیید هستند."
        )

    if not order.items.exists():
        raise ValueError(
            "سفارش بدون کالا قابل تأیید نیست."
        )

    order.status = Order.PENDING
    order.save(update_fields=["status", "updated_at"])

    return order


@transaction.atomic
def pay_order(order):
    order = (
        Order.objects
        .select_for_update()
        .get(pk=order.pk)
    )

    if order.status != Order.PENDING:
        raise ValueError(
            "فقط سفارش‌های در انتظار پرداخت قابل پرداخت هستند."
        )

    order.status = Order.PAID
    order.save(update_fields=["status", "updated_at"])

    return order


@transaction.atomic
def fulfill_order(order):
    order = (
        Order.objects
        .select_for_update()
        .prefetch_related("items__product")
        .get(pk=order.pk)
    )

    if order.status != Order.PAID:
        raise ValueError(
            "فقط سفارش‌های پرداخت‌شده قابل تحویل هستند."
        )

    if not order.items.exists():
        raise ValueError(
            "سفارش بدون کالا قابل تحویل نیست."
        )

    for item in order.items.all():
        StockMovement.objects.create(
            business=order.business,
            product=item.product,
            warehouse=order.warehouse,
            movement_type=StockMovement.OUT,
            quantity=item.quantity,
            reason=f"فروش سفارش {order.order_number}",
            created_by=order.created_by,
        )

    order.status = Order.FULFILLED
    order.save(update_fields=["status", "updated_at"])

    return order
