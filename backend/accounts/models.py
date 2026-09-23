from django.contrib.auth.models import AbstractUser
from django.db import models
from tenants.models import Business


class User(AbstractUser):
    """
    هر کاربر دقیقاً به یک کسب‌وکار تعلق دارد و نقشی دارد که
    سطح دسترسی او را در آن کسب‌وکار مشخص می‌کند.
    نقش «مالک» به‌صورت خودکار برای کسی که ثبت‌نام کرده و کسب‌وکار را ایجاد می‌کند تنظیم می‌شود.
    """

    ROLE_OWNER = "owner"
    ROLE_ADMIN = "admin"
    ROLE_MANAGER = "manager"
    ROLE_STAFF = "staff"

    ROLE_CHOICES = [
        (ROLE_OWNER, "مالک"),
        (ROLE_ADMIN, "مدیر سیستم"),
        (ROLE_MANAGER, "مدیر"),
        (ROLE_STAFF, "کارمند"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="members",
        null=True,
        blank=True,
        verbose_name="کسب‌وکار",
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_STAFF,
        verbose_name="نقش",
    )
    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="تلفن",
    )
    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
        verbose_name="تصویر پروفایل",
    )

    class Meta:
        verbose_name = "کاربر"
        verbose_name_plural = "کاربران"

    @property
    def is_business_admin(self):
        return self.role in (self.ROLE_OWNER, self.ROLE_ADMIN)

    def __str__(self):
        return self.get_full_name() or self.username