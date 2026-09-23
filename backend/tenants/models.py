from django.db import models
from django.utils.text import slugify
import uuid


class Business(models.Model):
    """
    A single tenant on the platform. Every business-scoped record in the
    system (customers, products, orders, tasks...) carries a FK to a
    Business so that data for different companies never mixes.
    """

    INDUSTRY_CHOICES = [
        ("general", "General"),
        ("retail", "Retail"),
        ("catering", "Catering & Food Service"),
        ("services", "Professional Services"),
        ("wholesale", "Wholesale / Distribution"),
        ("manufacturing", "Manufacturing"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    industry = models.CharField(max_length=30, choices=INDUSTRY_CHOICES, default="general")
    currency = models.CharField(max_length=8, default="USD")
    logo = models.ImageField(upload_to="business_logos/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

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
