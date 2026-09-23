from django.conf import settings
from django.db import models
from tenants.models import Business


class Customer(models.Model):
    STATUS_LEAD = "lead"
    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"

    STATUS_CHOICES = [
        (STATUS_LEAD, "سرنخ"),
        (STATUS_ACTIVE, "فعال"),
        (STATUS_INACTIVE, "غیرفعال"),
    ]

    SOURCE_CHOICES = [
        ("referral", "معرفی"),
        ("website", "وب‌سایت"),
        ("social", "شبکه‌های اجتماعی"),
        ("cold_outreach", "تماس سرد"),
        ("event", "رویداد"),
        ("other", "سایر"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="customers",
        verbose_name="کسب‌وکار",
    )
    name = models.CharField(max_length=200, verbose_name="نام")
    company = models.CharField(max_length=200, blank=True, verbose_name="شرکت")
    email = models.EmailField(blank=True, verbose_name="ایمیل")
    phone = models.CharField(max_length=30, blank=True, verbose_name="تلفن")
    address = models.CharField(max_length=300, blank=True, verbose_name="آدرس")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_LEAD,
        verbose_name="وضعیت",
    )
    source = models.CharField(
        max_length=30,
        choices=SOURCE_CHOICES,
        blank=True,
        verbose_name="منبع",
    )
    estimated_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="ارزش تخمینی",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_customers",
        verbose_name="مسئول",
    )
    tags = models.CharField(
        max_length=300,
        blank=True,
        help_text="برچسب‌ها را با ویرگول جدا کنید",
        verbose_name="برچسب‌ها",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
        verbose_name="ایجادکننده",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ به‌روزرسانی")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["business", "status"])]
        verbose_name = "مشتری"
        verbose_name_plural = "مشتریان"

    def __str__(self):
        return self.name


class CustomerNote(models.Model):
    """یادداشت زمانی (تماس، جلسه، ایمیل و ...) متصل به یک مشتری."""

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="customer_notes",
        verbose_name="کسب‌وکار",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="notes",
        verbose_name="مشتری",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="نویسنده",
    )
    body = models.TextField(verbose_name="متن یادداشت")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "یادداشت مشتری"
        verbose_name_plural = "یادداشت‌های مشتری"

    def __str__(self):
        return f"یادداشت برای {self.customer.name} ({self.created_at:%Y-%m-%d})"