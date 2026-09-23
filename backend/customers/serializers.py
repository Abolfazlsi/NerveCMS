from rest_framework import serializers
from .models import Customer, CustomerNote


class CustomerNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.get_full_name", read_only=True)

    class Meta:
        model = CustomerNote
        fields = ["id", "customer", "author", "author_name", "body", "created_at"]
        read_only_fields = ["id", "author", "created_at"]


class CustomerSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    notes = CustomerNoteSerializer(many=True, read_only=True)
    order_count = serializers.IntegerField(read_only=True, required=False)
    total_spent = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True, required=False)

    class Meta:
        model = Customer
        fields = [
            "id", "name", "company", "email", "phone", "address", "status", "source",
            "estimated_value", "assigned_to", "assigned_to_name", "tags",
            "notes", "order_count", "total_spent", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
