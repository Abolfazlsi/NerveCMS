from django.db import transaction
from django.utils import timezone
from inventory.models import Purchase, StockMovement, StockTransfer, WarehouseStock, PurchaseReturn


@transaction.atomic
def receive_purchase(purchase):
    purchase = (
        Purchase.objects
        .select_for_update()
        .prefetch_related("items__product")
        .get(pk=purchase.pk)
    )

    if purchase.status == Purchase.RECEIVED:
        raise ValueError("این خرید قبلاً دریافت شده است.")

    if purchase.status == Purchase.CANCELLED:
        raise ValueError("خرید لغو شده و قابل دریافت نیست.")

    if not purchase.items.exists():
        raise ValueError("خرید نمی‌تواند بدون محصول دریافت شود.")

    for item in purchase.items.all():
        StockMovement.objects.create(
            business=purchase.business,
            product=item.product,
            warehouse=purchase.warehouse,
            movement_type=StockMovement.IN,
            quantity=item.quantity,
            reason=f"دریافت خرید {purchase.purchase_number}",
        )

    purchase.status = Purchase.RECEIVED

    purchase.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return purchase


@transaction.atomic
def complete_stock_transfer(transfer):
    transfer = (
        StockTransfer.objects
        .select_for_update()
        .select_related(
            "product",
            "source_warehouse",
            "destination_warehouse",
        )
        .get(pk=transfer.pk)
    )

    if transfer.status == StockTransfer.COMPLETED:
        raise ValueError("این انتقال قبلاً تکمیل شده است.")

    if transfer.status == StockTransfer.CANCELLED:
        raise ValueError("انتقال لغو شده و قابل تکمیل نیست.")

    source_stock = (
        WarehouseStock.objects
        .select_for_update()
        .filter(
            warehouse=transfer.source_warehouse,
            product=transfer.product,
        )
        .first()
    )

    if not source_stock:
        raise ValueError(
            "برای این محصول در انبار مبدأ موجودی ثبت نشده است."
        )

    if source_stock.quantity < transfer.quantity:
        raise ValueError(
            "موجودی انبار مبدأ برای این انتقال کافی نیست."
        )

    destination_stock, _ = (
        WarehouseStock.objects
        .select_for_update()
        .get_or_create(
            warehouse=transfer.destination_warehouse,
            product=transfer.product,
            defaults={
                "reorder_level": transfer.product.reorder_level,
            },
        )
    )

    StockMovement.objects.create(
        business=transfer.business,
        product=transfer.product,
        warehouse=transfer.source_warehouse,
        movement_type=StockMovement.OUT,
        quantity=transfer.quantity,
        reason=f"انتقال به {transfer.destination_warehouse.name}",
        created_by=transfer.created_by,
    )

    StockMovement.objects.create(
        business=transfer.business,
        product=transfer.product,
        warehouse=transfer.destination_warehouse,
        movement_type=StockMovement.IN,
        quantity=transfer.quantity,
        reason=f"انتقال از {transfer.source_warehouse.name}",
        created_by=transfer.created_by,
    )

    transfer.status = StockTransfer.COMPLETED
    transfer.completed_at = timezone.now()

    transfer.save(
        update_fields=[
            "status",
            "completed_at",
        ]
    )

    return transfer


@transaction.atomic
def adjust_stock(
        *,
        business,
        product,
        warehouse,
        quantity,
        reason,
        created_by,
):
    warehouse_stock, _ = (
        WarehouseStock.objects
        .select_for_update()
        .get_or_create(
            warehouse=warehouse,
            product=product,
            defaults={
                "reorder_level": product.reorder_level,
            },
        )
    )

    current_quantity = warehouse_stock.quantity

    movement = StockMovement.objects.create(
        business=business,
        product=product,
        warehouse=warehouse,
        movement_type=StockMovement.ADJUSTMENT,
        quantity=quantity,
        reason=reason,
        created_by=created_by,
    )

    return movement, current_quantity


@transaction.atomic
def complete_purchase_return(purchase_return):
    purchase_return = (
        PurchaseReturn.objects
        .select_for_update()
        .prefetch_related("items__product")
        .get(pk=purchase_return.pk)
    )

    if purchase_return.status == PurchaseReturn.COMPLETED:
        raise ValueError("این مرجوعی خرید قبلاً تکمیل شده است.")

    if purchase_return.status == PurchaseReturn.CANCELLED:
        raise ValueError("این مرجوعی خرید لغو شده و قابل تکمیل نیست.")

    if not purchase_return.items.exists():
        raise ValueError("مرجوعی خرید نمی‌تواند بدون محصول باشد.")

    for item in purchase_return.items.all():
        StockMovement.objects.create(
            business=purchase_return.business,
            product=item.product,
            warehouse=purchase_return.warehouse,
            movement_type=StockMovement.OUT,
            quantity=item.quantity,
            reason=f"مرجوعی خرید {purchase_return.purchase.purchase_number}",
            created_by=purchase_return.created_by,
        )

    purchase_return.status = PurchaseReturn.COMPLETED
    purchase_return.completed_at = timezone.now()

    purchase_return.save(
        update_fields=["status", "completed_at"]
    )

    return purchase_return
