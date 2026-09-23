from django.db.models import Count, F, Q
from core.viewsets import BusinessScopedViewSet
from .models import Category, Product, StockMovement
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer


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
