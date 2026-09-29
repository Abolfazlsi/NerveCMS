from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, StockMovementViewSet, PurchaseViewSet, SupplierViewSet, \
    WarehouseViewSet, StockTransferViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register(r"purchases", PurchaseViewSet, basename="purchases")
router.register(r"suppliers", SupplierViewSet, basename="suppliers")
router.register(r"warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"stock-transfers", StockTransferViewSet, basename="stock-transfer")

urlpatterns = router.urls
