from django.conf import settings
from django.db import models
from django.utils import timezone
from tenants.models import Business
from customers.models import Customer
from inventory.models import Product, StockMovement


class Order(models.Model):
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (DRAFT, "Draft"),
        (PENDING, "Pending Payment"),
        (PAID, "Paid"),
        (FULFILLED, "Fulfilled"),
        (CANCELLED, "Cancelled"),
    ]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="orders")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="orders")
    order_number = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)
    order_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-order_date", "-created_at"]

    def save(self, *args, **kwargs):
        if not self.order_number:
            count = Order.objects.filter(business=self.business).count() + 1
            self.order_number = f"ORD-{count:05d}"
        super().save(*args, **kwargs)

    @property
    def total_amount(self):
        return sum((item.line_total for item in self.items.all()), start=0)

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"
