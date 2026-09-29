from rest_framework import serializers
from django.utils import timezone
from finance.models import Invoice, Payment, Expense


class InvoiceSerializer(serializers.ModelSerializer):
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    order_number = serializers.CharField(
        source="order.order_number",
        read_only=True,
    )

    customer_name = serializers.CharField(
        source="order.customer.name",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = Invoice

        fields = [
            "id",
            "invoice_number",
            "order",
            "order_number",
            "customer_name",
            "status",
            "status_display",
            "subtotal",
            "discount",
            "tax",
            "total",
            "paid_amount",
            "remaining_amount",
            "payment_status",
            "issued_at",
            "created_by",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "invoice_number",
            "order_number",
            "customer_name",
            "status",
            "status_display",
            "subtotal",
            "discount",
            "tax",
            "total",
            "issued_at",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_paid_amount(self, obj):
        return sum(
            payment.amount
            for payment in obj.payments.all()
        )

    def get_remaining_amount(self, obj):
        paid_amount = self.get_paid_amount(obj)

        remaining = obj.total - paid_amount

        return max(remaining, 0)

    def get_payment_status(self, obj):
        paid_amount = self.get_paid_amount(obj)

        if paid_amount == 0:
            return "UNPAID"

        if paid_amount < obj.total:
            return "PARTIALLY_PAID"

        return "PAID"


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source="invoice.invoice_number",
        read_only=True,
    )

    payment_method_display = serializers.CharField(
        source="get_payment_method_display",
        read_only=True,
    )

    class Meta:
        model = Payment

        fields = [
            "id",
            "invoice",
            "invoice_number",
            "amount",
            "payment_method",
            "payment_method_display",
            "reference_number",
            "paid_at",
            "created_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "invoice_number",
            "payment_method_display",
            "created_by",
            "created_at",
        ]

    def validate_invoice(self, invoice):
        if invoice.business != self.context["request"].user.business:
            raise serializers.ValidationError(
                "این فاکتور متعلق به کسب‌وکار شما نیست."
            )

        return invoice

    def validate_amount(self, amount):
        if amount <= 0:
            raise serializers.ValidationError(
                "مبلغ پرداخت باید بیشتر از صفر باشد."
            )

        return amount

    def validate_paid_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError(
                "تاریخ پرداخت نمی‌تواند در آینده باشد."
            )

        return value


class ExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    class Meta:
        model = Expense

        fields = [
            "id",
            "title",
            "amount",
            "category",
            "description",
            "expense_date",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "مبلغ هزینه باید بیشتر از صفر باشد."
            )

        return value

    def validate_expense_date(self, value):
        from django.utils import timezone

        if value > timezone.localdate():
            raise serializers.ValidationError(
                "تاریخ هزینه نمی‌تواند در آینده باشد."
            )

        return value
