from django.db.models import Count, F, Q
from core.viewsets import BusinessScopedViewSet
from rest_framework import viewsets, status
from inventory.services import receive_purchase, complete_stock_transfer
from .models import Category, Product, StockMovement, Purchase, Supplier, Warehouse, StockTransfer
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer, PurchaseSerializer, \
    SupplierSerializer, WarehouseSerializer, StockTransferSerializer
from rest_framework.response import Response
from rest_framework.decorators import action


class CategoryViewSet(BusinessScopedViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(business=self.request.user.business).annotate(
            product_count=Count("products")
        )


class ProductViewSet(BusinessScopedViewSet):
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(business=self.request.user.business)
        category = self.request.query_params.get("category")
        low_stock = self.request.query_params.get("low_stock")
        search = self.request.query_params.get("search")
        if category:
            qs = qs.filter(category_id=category)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        qs = qs.select_related("category")
        if low_stock == "true":
            qs = qs.filter(quantity_in_stock__lte=F("reorder_level"))
        return qs.order_by("name")


class StockMovementViewSet(BusinessScopedViewSet):
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        qs = StockMovement.objects.filter(business=self.request.user.business).select_related("product")
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        return qs.order_by("-created_at")


class PurchaseViewSet(BusinessScopedViewSet):
    queryset = Purchase.objects.all()
    serializer_class = PurchaseSerializer

    def get_queryset(self):
        return (
            Purchase.objects
            .filter(
                business=self.request.user.business
            )
            .select_related(
                "supplier",
                "warehouse",
            )
            .prefetch_related(
                "items__product",
            )
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="receive",
    )
    def receive(self, request, pk=None):
        purchase = self.get_object()

        try:
            purchase = receive_purchase(purchase)

        except ValueError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(purchase)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class SupplierViewSet(BusinessScopedViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class WarehouseViewSet(BusinessScopedViewSet):
    serializer_class = WarehouseSerializer

    def get_queryset(self):
        return (
            Warehouse.objects
            .filter(
                business=self.request.user.business
            )
            .annotate(
                stock_count=Count("stocks")
            )
            .order_by("name")
        )


class StockTransferViewSet(BusinessScopedViewSet):
    queryset = StockTransfer.objects.all()
    serializer_class = StockTransferSerializer

    def get_queryset(self):
        return (
            StockTransfer.objects
            .filter(
                business=self.request.user.business
            )
            .select_related(
                "product",
                "source_warehouse",
                "destination_warehouse",
                "created_by",
            )
            .order_by("-created_at")
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):
        transfer = self.get_object()

        try:
            transfer = complete_stock_transfer(transfer)

        except ValueError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(transfer)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )
