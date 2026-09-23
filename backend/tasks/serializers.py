from rest_framework import serializers
from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    customer_name = serializers.CharField(source="related_customer.name", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "related_customer", "customer_name",
            "assigned_to", "assigned_to_name", "priority", "status", "due_date",
            "is_overdue", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_is_overdue(self, obj):
        from django.utils import timezone
        return bool(obj.due_date and obj.due_date < timezone.localdate() and obj.status != Task.DONE)
