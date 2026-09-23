from django.db.models import Count, Sum, Q, F, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import viewsets, permissions
from core.viewsets import BusinessScopedViewSet
from .models import Customer, CustomerNote
from .serializers import CustomerSerializer, CustomerNoteSerializer


class CustomerViewSet(BusinessScopedViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = (
            Customer.objects.filter(business=self.request.user.business)
            .annotate(
                order_count=Count("orders", distinct=True),
                total_spent=Coalesce(
                    Sum(
                        F("orders__items__quantity") * F("orders__items__unit_price"),
                        filter=Q(orders__status="paid"),
                    ),
                    0,
                    output_field=DecimalField(),
                ),
            )
        )
        status = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if status:
            qs = qs.filter(status=status)
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(company__icontains=search) | Q(email__icontains=search)
            )
        return qs.order_by("-created_at")


class CustomerNoteViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerNoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomerNote.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business, author=self.request.user)
