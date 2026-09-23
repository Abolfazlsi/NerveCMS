from django.contrib import admin
from .models import Category, Product, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "business")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "business", "quantity_in_stock", "reorder_level", "unit_price")
    list_filter = ("business", "category", "is_active")
    search_fields = ("name", "sku")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "created_at")
    list_filter = ("movement_type",)
