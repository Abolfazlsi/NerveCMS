from django.conf import settings
from django.db import models
from tenants.models import Business


class Category(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("business", "name")
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    sku = models.CharField(max_length=60)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=30, default="unit", help_text="e.g. unit, kg, box, hour")
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity_in_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(
        max_digits=12, decimal_places=2, default=10,
        help_text="Stock alert triggers at or below this level",
    )
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("business", "sku")
        indexes = [models.Index(fields=["business", "is_active"])]

    @property
    def is_low_stock(self):
        return self.quantity_in_stock <= self.reorder_level

    @property
    def stock_value(self):
        return self.quantity_in_stock * self.cost_price

    def __str__(self):
        return f"{self.name} ({self.sku})"


class StockMovement(models.Model):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"
    TYPE_CHOICES = [(IN, "Stock In"), (OUT, "Stock Out"), (ADJUSTMENT, "Adjustment")]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="stock_movements")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            product = self.product
            if self.movement_type == self.IN:
                product.quantity_in_stock += self.quantity
            elif self.movement_type == self.OUT:
                product.quantity_in_stock -= self.quantity
            else:  # adjustment sets an absolute quantity
                product.quantity_in_stock = self.quantity
            product.save(update_fields=["quantity_in_stock", "updated_at"])

    def __str__(self):
        return f"{self.product.name}: {self.get_movement_type_display()} {self.quantity}"
