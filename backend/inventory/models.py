from django.conf import settings
from django.db import models
from tenants.models import Business
from django.db import models, transaction


class Category(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="categories",
        verbose_name="کسب‌وکار",
    )
    name = models.CharField(max_length=120, verbose_name="نام")
    description = models.CharField(max_length=300, blank=True, verbose_name="توضیحات")

    class Meta:
        ordering = ["name"]
        unique_together = ("business", "name")
        verbose_name = "دسته‌بندی"
        verbose_name_plural = "دسته‌بندی‌ها"

    def __str__(self):
        return self.name


class Warehouse(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="warehouses",
        verbose_name="کسب‌وکار",
    )
    name = models.CharField(
        max_length=150,
        verbose_name="نام انبار",
    )
    code = models.CharField(
        max_length=50,
        verbose_name="کد انبار",
    )
    address = models.CharField(
        max_length=300,
        blank=True,
        verbose_name="آدرس",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال",
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="انبار پیش‌فرض",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="تاریخ به‌روزرسانی",
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "code"],
                name="unique_warehouse_code_per_business",
            ),
        ]
        indexes = [
            models.Index(fields=["business", "is_active"]),
        ]
        verbose_name = "انبار"
        verbose_name_plural = "انبارها"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Product(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="products",
        verbose_name="کسب‌وکار",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="دسته‌بندی",
    )
    sku = models.CharField(max_length=60, verbose_name="کد کالا (SKU)")
    name = models.CharField(max_length=200, verbose_name="نام محصول")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    unit = models.CharField(
        max_length=30,
        default="unit",
        help_text="مثلاً عدد، کیلوگرم، جعبه، ساعت",
        verbose_name="واحد",
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="قیمت تمام‌شده",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="قیمت فروش",
    )
    quantity_in_stock = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="موجودی انبار",
    )
    reorder_level = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=10,
        help_text="هشدار کمبود موجودی وقتی موجودی به این مقدار یا کمتر برسد فعال می‌شود",
        verbose_name="حد سفارش مجدد",
    )
    image = models.ImageField(
        upload_to="products/",
        blank=True,
        null=True,
        verbose_name="تصویر",
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ به‌روزرسانی")

    class Meta:
        ordering = ["name"]
        unique_together = ("business", "sku")
        indexes = [models.Index(fields=["business", "is_active"])]
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"

    @property
    def is_low_stock(self):
        return self.quantity_in_stock <= self.reorder_level

    @property
    def stock_value(self):
        return self.quantity_in_stock * self.cost_price

    def __str__(self):
        return f"{self.name} ({self.sku})"


class WarehouseStock(models.Model):
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="stocks",
        verbose_name="انبار",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="warehouse_stocks",
        verbose_name="محصول",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="موجودی",
    )
    reorder_level = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=10,
        verbose_name="حد سفارش مجدد",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخرین بروزرسانی",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["warehouse", "product"],
                name="unique_product_per_warehouse",
            ),
        ]
        indexes = [
            models.Index(fields=["warehouse", "product"]),
        ]
        verbose_name = "موجودی انبار"
        verbose_name_plural = "موجودی انبارها"

    @property
    def is_low_stock(self):
        return self.quantity <= self.reorder_level

    @property
    def stock_value(self):
        return self.quantity * self.product.cost_price

    def __str__(self):
        return f"{self.warehouse.name} - {self.product.name}: {self.quantity}"


class StockMovement(models.Model):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"

    TYPE_CHOICES = [
        (IN, "ورود به انبار"),
        (OUT, "خروج از انبار"),
        (ADJUSTMENT, "تنظیم موجودی"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        verbose_name="کسب‌وکار",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="movements",
        verbose_name="محصول",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        verbose_name="انبار",
        null=True,
        blank=True
    )
    movement_type = models.CharField(
        max_length=15,
        choices=TYPE_CHOICES,
        verbose_name="نوع حرکت",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="مقدار",
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="دلیل",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="ایجادکننده",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "حرکت موجودی"
        verbose_name_plural = "حرکات موجودی"

    def save(self, *args, **kwargs):
        is_new = self._state.adding

        if not is_new:
            super().save(*args, **kwargs)
            return

        with transaction.atomic():
            warehouse_stock, _ = WarehouseStock.objects.select_for_update().get_or_create(
                warehouse=self.warehouse,
                product=self.product,
                defaults={
                    "reorder_level": self.product.reorder_level,
                },
            )

            if self.movement_type == self.IN:
                warehouse_stock.quantity += self.quantity

            elif self.movement_type == self.OUT:
                if warehouse_stock.quantity < self.quantity:
                    raise ValueError("موجودی انبار کافی نیست.")

                warehouse_stock.quantity -= self.quantity

            elif self.movement_type == self.ADJUSTMENT:
                warehouse_stock.quantity = self.quantity

            warehouse_stock.save()

            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name}: {self.get_movement_type_display()} {self.quantity}"


class StockTransfer(models.Model):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (DRAFT, "پیش‌نویس"),
        (COMPLETED, "تکمیل شده"),
        (CANCELLED, "لغو شده"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="stock_transfers",
        verbose_name="کسب‌وکار",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_transfers",
        verbose_name="محصول",
    )

    source_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="outgoing_transfers",
        verbose_name="انبار مبدأ",
    )

    destination_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
        verbose_name="انبار مقصد",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="مقدار",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=DRAFT,
        verbose_name="وضعیت",
    )

    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="دلیل انتقال",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_stock_transfers",
        verbose_name="ایجادکننده",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ تکمیل",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "status"]),
            models.Index(fields=["business", "created_at"]),
        ]
        verbose_name = "انتقال موجودی"
        verbose_name_plural = "انتقال‌های موجودی"

    def __str__(self):
        return (
            f"{self.product} - "
            f"{self.source_warehouse} → "
            f"{self.destination_warehouse}"
        )


class Supplier(models.Model):
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="suppliers",
        verbose_name="کسب‌وکار",
    )

    name = models.CharField(
        max_length=150,
        verbose_name="نام تأمین‌کننده",
    )

    company_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="نام شرکت",
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="شماره تماس",
    )

    email = models.EmailField(
        blank=True,
        verbose_name="ایمیل",
    )

    address = models.TextField(
        blank=True,
        verbose_name="آدرس",
    )

    tax_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="شناسه مالیاتی",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="یادداشت",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخرین بروزرسانی",
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["business", "is_active"]),
        ]
        verbose_name = "تأمین‌کننده"
        verbose_name_plural = "تأمین‌کنندگان"

    def __str__(self):
        return self.name


class Purchase(models.Model):
    DRAFT = "draft"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (DRAFT, "پیش‌نویس"),
        (ORDERED, "سفارش داده شده"),
        (RECEIVED, "دریافت شده"),
        (CANCELLED, "لغو شده"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="purchases",
        verbose_name="کسب‌وکار",
    )

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchases",
        verbose_name="تأمین‌کننده",
    )

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="purchases",
        verbose_name="انبار",
    )

    purchase_number = models.CharField(
        max_length=50,
        verbose_name="شماره خرید",
    )

    purchase_date = models.DateField(
        verbose_name="تاریخ خرید",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=DRAFT,
        verbose_name="وضعیت",
    )

    discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="تخفیف",
    )

    tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="مالیات",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="یادداشت",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="آخرین بروزرسانی",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "purchase_number"],
                name="unique_purchase_number_per_business",
            ),
        ]
        indexes = [
            models.Index(fields=["business", "status"]),
            models.Index(fields=["business", "purchase_date"]),
        ]
        verbose_name = "خرید"
        verbose_name_plural = "خریدها"

    def __str__(self):
        return self.purchase_number

    @property
    def subtotal(self):
        return sum(
            item.total_price
            for item in self.items.all()
        )

    @property
    def total_amount(self):
        return self.subtotal - self.discount + self.tax


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="خرید",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_items",
        verbose_name="محصول",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="تعداد",
    )

    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="قیمت خرید",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "آیتم خرید"
        verbose_name_plural = "آیتم‌های خرید"

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"

    @property
    def total_price(self):
        return self.quantity * self.purchase_price


class PurchaseReturn(models.Model):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (DRAFT, "پیش‌نویس"),
        (COMPLETED, "تکمیل شده"),
        (CANCELLED, "لغو شده"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="purchase_returns",
    )

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.PROTECT,
        related_name="returns",
    )

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="purchase_returns",
    )

    reason = models.CharField(
        max_length=255,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=DRAFT,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(
        PurchaseReturn,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_return_items",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
