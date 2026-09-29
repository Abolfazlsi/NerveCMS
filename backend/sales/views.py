from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.viewsets import BusinessScopedViewSet
from .models import Order, SalesReturnItem, SalesReturn
from .serializers import OrderSerializer, SalesReturnItemSerializer, SalesReturnSerializer
from sales.services import complete_sales_return


class OrderViewSet(BusinessScopedViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.filter(
            business=self.request.user.business
        ).select_related(
            "customer",
            "warehouse",
        ).prefetch_related(
            "items__product"
        )
        status = self.request.query_params.get("status")
        customer = self.request.query_params.get("customer")
        search = self.request.query_params.get("search")
        if status:
            qs = qs.filter(status=status)
        if customer:
            qs = qs.filter(customer_id=customer)
        if search:
            qs = qs.filter(Q(order_number__icontains=search) | Q(customer__name__icontains=search))
        return qs.order_by("-order_date", "-created_at")


class SalesReturnViewSet(BusinessScopedViewSet):
    serializer_class = SalesReturnSerializer

    def get_queryset(self):
        return (
            SalesReturn.objects
            .filter(business=self.request.user.business)
            .select_related(
                "order",
                "warehouse",
                "created_by",
            )
            .prefetch_related(
                "items__product",
            )
            .order_by("-created_at")
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):
        sales_return = self.get_object()

        try:
            sales_return = complete_sales_return(sales_return)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(sales_return)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )
