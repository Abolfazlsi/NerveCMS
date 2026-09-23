from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = router.urls
