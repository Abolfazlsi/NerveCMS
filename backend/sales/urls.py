from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, SalesReturnViewSet

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")
router.register("returns", SalesReturnViewSet, basename="sales-return")

urlpatterns = router.urls
