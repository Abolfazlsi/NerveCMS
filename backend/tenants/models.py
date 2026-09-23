from django.db import models
from django.utils.text import slugify
import uuid


class Business(models.Model):
    """
    یک مستأجر (tenant) در پلتفرم.
    هر رکورد مرتبط با کسب‌وکار (مشتریان، محصولات، سفارش‌ها، وظایف و ...)
    یک کلید خارجی به Business دارد تا داده‌های شرکت‌های مختلف با هم مخلوط نشوند.
    """

    INDUSTRY_CHOICES = [
        ("general", "عمومی"),
        ("retail", "خرده‌فروشی"),
        ("catering", "خدمات غذایی و پذیرایی"),
        ("services", "خدمات حرفه‌ای"),
        ("wholesale", "عمده‌فروشی / توزیع"),
        ("manufacturing", "تولید"),
        ("other", "سایر"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="شناسه",
    )
    name = models.CharField(max_length=150, verbose_name="نام کسب‌وکار")
    slug = models.SlugField(
        max_length=170,
        unique=True,
        blank=True,
        verbose_name="اسلاگ",
    )
    industry = models.CharField(
        max_length=30,
        choices=INDUSTRY_CHOICES,
        default="general",
        verbose_name="صنعت",
    )
    currency = models.CharField(
        max_length=8,
        default="USD",
        verbose_name="واحد پول",
    )
    logo = models.ImageField(
        upload_to="business_logos/",
        blank=True,
        null=True,
        verbose_name="لوگو",
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ به‌روزرسانی")

    class Meta:
        ordering = ["name"]
        verbose_name = "کسب‌وکار"
        verbose_name_plural = "کسب‌وکارها"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)
            slug = base
            i = 1
            while Business.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base}-{i}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name