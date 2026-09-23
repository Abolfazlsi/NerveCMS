from django.db.models import Q
from core.viewsets import BusinessScopedViewSet
from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(BusinessScopedViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.filter(business=self.request.user.business).select_related(
            "customer"
        ).prefetch_related("items__product")
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
