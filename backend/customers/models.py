from django.conf import settings
from django.db import models
from tenants.models import Business


class Customer(models.Model):
    STATUS_LEAD = "lead"
    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"
    STATUS_CHOICES = [
        (STATUS_LEAD, "Lead"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_INACTIVE, "Inactive"),
    ]

    SOURCE_CHOICES = [
        ("referral", "Referral"),
        ("website", "Website"),
        ("social", "Social Media"),
        ("cold_outreach", "Cold Outreach"),
        ("event", "Event"),
        ("other", "Other"),
    ]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_LEAD)
    source = models.CharField(max_length=30, choices=SOURCE_CHOICES, blank=True)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_customers",
    )
    tags = models.CharField(max_length=300, blank=True, help_text="Comma-separated tags")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["business", "status"])]

    def __str__(self):
        return self.name


class CustomerNote(models.Model):
    """A timestamped log entry (call, meeting, email...) attached to a customer."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customer_notes")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note on {self.customer.name} ({self.created_at:%Y-%m-%d})"
