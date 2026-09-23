from django.contrib import admin
from .models import Customer, CustomerNote


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "status", "assigned_to", "estimated_value")
    list_filter = ("business", "status")
    search_fields = ("name", "email", "company")


@admin.register(CustomerNote)
class CustomerNoteAdmin(admin.ModelAdmin):
    list_display = ("customer", "author", "created_at")
