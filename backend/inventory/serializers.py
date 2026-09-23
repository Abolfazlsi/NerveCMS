from rest_framework import serializers
from .models import Category, Product, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "product_count"]
        read_only_fields = ["id"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "description", "category", "category_name", "unit",
            "cost_price", "unit_price", "quantity_in_stock", "reorder_level",
            "is_low_stock", "stock_value", "image", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "quantity_in_stock", "created_at", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "movement_type", "quantity",
            "reason", "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]
