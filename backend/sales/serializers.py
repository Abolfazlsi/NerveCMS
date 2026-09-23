from rest_framework import serializers
from django.db import transaction
from inventory.models import Product, StockMovement
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "sku", "quantity", "unit_price", "line_total"]
        read_only_fields = ["id"]


class OrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    items = OrderItemSerializer(many=True)
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "customer", "customer_name", "status", "order_date",
            "due_date", "notes", "items", "total_amount", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "order_number", "created_at", "updated_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("An order needs at least one item.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        self._sync_items(order, items_data, deduct_stock=order.status in ("paid", "fulfilled"))
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        was_fulfilled = instance.status in ("paid", "fulfilled")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            self._sync_items(
                instance, items_data,
                deduct_stock=(not was_fulfilled) and instance.status in ("paid", "fulfilled"),
            )
        return instance

    def _sync_items(self, order, items_data, deduct_stock):
        request = self.context.get("request")
        for item in items_data:
            oi = OrderItem.objects.create(order=order, **item)
            if deduct_stock:
                StockMovement.objects.create(
                    business=order.business,
                    product=oi.product,
                    movement_type=StockMovement.OUT,
                    quantity=oi.quantity,
                    reason=f"Sold on {order.order_number}",
                    created_by=getattr(request, "user", None),
                )
