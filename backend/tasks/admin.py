from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "business", "assigned_to", "status", "priority", "due_date")
    list_filter = ("business", "status", "priority")
