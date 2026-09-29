from django.db import transaction, models
from django.utils import timezone

from finance.models import Invoice, Payment
from sales.models import Order


@transaction.atomic
def create_invoice_from_order(order):
    order = (
        Order.objects
        .select_for_update()
        .prefetch_related("items")
        .get(pk=order.pk)
    )

    if order.status == Order.CANCELLED:
        raise ValueError(
            "برای سفارش لغوشده نمی‌توان فاکتور ایجاد کرد."
        )

    if not order.items.exists():
        raise ValueError(
            "برای سفارش بدون کالا نمی‌توان فاکتور ایجاد کرد."
        )

    if hasattr(order, "invoice"):
        raise ValueError(
            "این سفارش قبلاً فاکتور دارد."
        )

    subtotal = order.total_amount
    discount = 0
    tax = 0
    total = subtotal - discount + tax

    invoice = Invoice.objects.create(
        business=order.business,
        order=order,
        invoice_number=generate_invoice_number(order.business_id),
        status=Invoice.DRAFT,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        total=total,
        created_by=order.created_by,
    )

    return invoice


def generate_invoice_number(business_id):
    last_invoice = (
        Invoice.objects
        .filter(business_id=business_id)
        .order_by("-id")
        .first()
    )

    next_number = 1 if not last_invoice else last_invoice.id + 1

    return f"INV-{business_id}-{next_number:05d}"


@transaction.atomic
def issue_invoice(invoice):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status != Invoice.DRAFT:
        raise ValueError(
            "فقط فاکتورهای پیش‌نویس قابل صدور هستند."
        )

    invoice.status = Invoice.ISSUED
    invoice.issued_at = timezone.now()

    invoice.save(
        update_fields=[
            "status",
            "issued_at",
            "updated_at",
        ]
    )

    return invoice


@transaction.atomic
def create_payment(
        invoice,
        amount,
        payment_method,
        paid_at,
        reference_number="",
        created_by=None,
):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status not in [
        Invoice.ISSUED,
        Invoice.PAID,
    ]:
        raise ValueError(
            "فقط فاکتورهای صادرشده قابل پرداخت هستند."
        )

    if amount <= 0:
        raise ValueError(
            "مبلغ پرداخت باید بیشتر از صفر باشد."
        )

    paid_amount = (
            invoice.payments.aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    remaining_amount = invoice.total - paid_amount

    if amount > remaining_amount:
        raise ValueError(
            f"مبلغ پرداخت نمی‌تواند بیشتر از مانده فاکتور باشد. "
            f"مانده: {remaining_amount}"
        )

    payment = Payment.objects.create(
        business=invoice.business,
        invoice=invoice,
        amount=amount,
        payment_method=payment_method,
        reference_number=reference_number,
        paid_at=paid_at,
        created_by=created_by,
    )

    new_paid_amount = paid_amount + amount

    if new_paid_amount >= invoice.total:
        invoice.status = Invoice.PAID
        invoice.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

    return payment


@transaction.atomic
def cancel_invoice(invoice):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status == Invoice.PAID:
        raise ValueError(
            "فاکتور پرداخت‌شده قابل لغو نیست."
        )

    if invoice.status == Invoice.CANCELLED:
        raise ValueError(
            "این فاکتور قبلاً لغو شده است."
        )

    invoice.status = Invoice.CANCELLED

    invoice.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return invoice
