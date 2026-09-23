from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, CustomerNoteViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("customer-notes", CustomerNoteViewSet, basename="customer-note")

urlpatterns = router.urls
