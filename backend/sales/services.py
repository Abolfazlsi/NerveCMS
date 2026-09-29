from django.db import transaction
from django.utils import timezone

from inventory.models import StockMovement
from sales.models import SalesReturn


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
