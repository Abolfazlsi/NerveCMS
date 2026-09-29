from django.conf import settings
from django.db import models

from tenants.models import Business
from sales.models import Order


class Invoice(models.Model):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (DRAFT, "پیش‌نویس"),
        (ISSUED, "صادر شده"),
        (PAID, "پرداخت شده"),
        (CANCELLED, "لغو شده"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="invoices",
        verbose_name="کسب‌وکار",
    )

    order = models.OneToOneField(
        Order,
        on_delete=models.PROTECT,
        related_name="invoice",
        verbose_name="سفارش",
    )

    invoice_number = models.CharField(
        max_length=30,
        verbose_name="شماره فاکتور",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=DRAFT,
        verbose_name="وضعیت",
    )

    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="مبلغ اولیه",
    )

    discount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="تخفیف",
    )

    tax = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="مالیات",
    )

    total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="مبلغ نهایی",
    )

    issued_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ صدور",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invoices",
        verbose_name="ایجادکننده",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ایجاد",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="تاریخ بروزرسانی",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "invoice_number"],
                name="unique_invoice_number_per_business",
            ),
        ]
        indexes = [
            models.Index(fields=["business", "status"]),
            models.Index(fields=["business", "created_at"]),
        ]
        verbose_name = "فاکتور"
        verbose_name_plural = "فاکتورها"

    def __str__(self):
        return self.invoice_number


class Payment(models.Model):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    ONLINE = "online"
    OTHER = "other"

    PAYMENT_METHOD_CHOICES = [
        (CASH, "نقدی"),
        (CARD, "کارتخوان"),
        (BANK_TRANSFER, "انتقال بانکی"),
        (ONLINE, "آنلاین"),
        (OTHER, "سایر"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name="کسب‌وکار",
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="فاکتور",
    )

    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="مبلغ پرداخت",
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        verbose_name="روش پرداخت",
    )

    reference_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="شماره پیگیری",
    )

    paid_at = models.DateTimeField(
        verbose_name="تاریخ پرداخت",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_payments",
        verbose_name="ثبت‌کننده",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ ثبت",
    )

    class Meta:
        ordering = ["-paid_at"]
        indexes = [
            models.Index(fields=["business", "paid_at"]),
            models.Index(fields=["business", "invoice"]),
        ]
        verbose_name = "پرداخت"
        verbose_name_plural = "پرداخت‌ها"

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"

