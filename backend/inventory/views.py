from django.db.models import Count, F, Q
from core.viewsets import BusinessScopedViewSet
from rest_framework import viewsets, status
from inventory.services import receive_purchase, complete_stock_transfer, adjust_stock, complete_purchase_return
from .models import Category, Product, StockMovement, Purchase, Supplier, Warehouse, StockTransfer, PurchaseReturn, \
    WarehouseStock
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer, PurchaseSerializer, \
    SupplierSerializer, WarehouseSerializer, StockTransferSerializer, StockAdjustmentSerializer, \
    PurchaseReturnSerializer, WarehouseStockSerializer
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

    @action(
        detail=False,
        methods=["post"],
        url_path="adjust",
    )
    def adjust(self, request):
        serializer = StockAdjustmentSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        movement, _ = adjust_stock(
            business=request.user.business,
            product=serializer.validated_data["product"],
            warehouse=serializer.validated_data["warehouse"],
            quantity=serializer.validated_data["quantity"],
            reason=serializer.validated_data.get("reason", ""),
            created_by=request.user,
        )

        response_serializer = StockMovementSerializer(
            movement,
            context={"request": request},
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "حرکت موجودی قابل ویرایش نیست."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "حرکت موجودی قابل حذف نیست."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


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


class PurchaseReturnViewSet(BusinessScopedViewSet):
    serializer_class = PurchaseReturnSerializer

    def get_queryset(self):
        return (
            PurchaseReturn.objects
            .filter(business=self.request.user.business)
            .select_related(
                "purchase",
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
        purchase_return = self.get_object()

        try:
            purchase_return = complete_purchase_return(
                purchase_return
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(purchase_return)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class WarehouseStockViewSet(BusinessScopedViewSet):
    serializer_class = WarehouseStockSerializer

    def get_queryset(self):
        qs = (
            WarehouseStock.objects
            .filter(
                warehouse__business=self.request.user.business
            )
            .select_related(
                "warehouse",
                "product",
            )
            .order_by(
                "warehouse__name",
                "product__name",
            )
        )

        product = self.request.query_params.get("product")
        warehouse = self.request.query_params.get("warehouse")

        if product:
            qs = qs.filter(product_id=product)

        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)

        return qs
