from django.conf import settings
from django.db import models
from tenants.models import Business
from customers.models import Customer


class Task(models.Model):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    STATUS_CHOICES = [(TODO, "To Do"), (IN_PROGRESS, "In Progress"), (DONE, "Done")]

    LOW, MEDIUM, HIGH = "low", "medium", "high"
    PRIORITY_CHOICES = [(LOW, "Low"), (MEDIUM, "Medium"), (HIGH, "High")]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    related_customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_tasks",
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=MEDIUM)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=TODO)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-priority"]

    def __str__(self):
        return self.title
