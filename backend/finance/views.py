from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from core.viewsets import BusinessScopedViewSet

from finance.models import Invoice, Payment
from finance.serializers import InvoiceSerializer, PaymentSerializer
from finance.services import create_invoice_from_order, issue_invoice, create_payment, cancel_invoice


class InvoiceViewSet(BusinessScopedViewSet):
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        return (
            Invoice.objects
            .filter(business=self.request.user.business)
            .select_related(
                "order",
                "order__customer",
                "created_by",
            )
            .prefetch_related("payments")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        order_id = request.data.get("order")

        if not order_id:
            return Response(
                {"detail": "شناسه سفارش الزامی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order = self.request.user.business.orders.get(
                pk=order_id
            )
        except Exception:
            return Response(
                {"detail": "سفارش پیدا نشد."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            invoice = create_invoice_from_order(order)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(invoice)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="issue",
    )
    def issue(self, request, pk=None):
        invoice = self.get_object()

        try:
            invoice = issue_invoice(invoice)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(invoice)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        invoice = self.get_object()

        try:
            invoice = cancel_invoice(invoice)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(invoice)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class PaymentViewSet(BusinessScopedViewSet):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = (
            Payment.objects
            .filter(business=self.request.user.business)
            .select_related(
                "invoice",
                "created_by",
            )
            .order_by("-paid_at")
        )

        invoice = self.request.query_params.get("invoice")

        if invoice:
            qs = qs.filter(invoice_id=invoice)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = serializer.validated_data["invoice"]

        try:
            payment = create_payment(
                invoice=invoice,
                amount=serializer.validated_data["amount"],
                payment_method=serializer.validated_data["payment_method"],
                paid_at=serializer.validated_data["paid_at"],
                reference_number=serializer.validated_data.get(
                    "reference_number",
                    "",
                ),
                created_by=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        output_serializer = self.get_serializer(payment)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "پرداخت ثبت‌شده قابل ویرایش نیست."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "پرداخت ثبت‌شده قابل حذف نیست."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
