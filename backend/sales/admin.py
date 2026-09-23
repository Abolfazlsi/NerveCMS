from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "business", "customer", "status", "order_date")
    list_filter = ("business", "status")
    inlines = [OrderItemInline]
