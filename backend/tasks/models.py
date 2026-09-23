from django.conf import settings
from django.db import models
from tenants.models import Business
from customers.models import Customer


class Task(models.Model):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"

    STATUS_CHOICES = [
        (TODO, "برای انجام"),
        (IN_PROGRESS, "در حال انجام"),
        (DONE, "انجام‌شده"),
    ]

    LOW, MEDIUM, HIGH = "low", "medium", "high"

    PRIORITY_CHOICES = [
        (LOW, "کم"),
        (MEDIUM, "متوسط"),
        (HIGH, "بالا"),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name="کسب‌وکار",
    )
    title = models.CharField(max_length=200, verbose_name="عنوان")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    related_customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        verbose_name="مشتری مرتبط",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
        verbose_name="مسئول",
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default=MEDIUM,
        verbose_name="اولویت",
    )
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default=TODO,
        verbose_name="وضعیت",
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاریخ سررسید",
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
        ordering = ["due_date", "-priority"]
        verbose_name = "وظیفه"
        verbose_name_plural = "وظایف"

    def __str__(self):
        return self.title