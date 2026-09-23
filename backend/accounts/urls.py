from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import BusinessTokenObtainPairView, MeView, SignupView, TeamViewSet

router = DefaultRouter()
router.register("team", TeamViewSet, basename="team")

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", BusinessTokenObtainPairView.as_view(), name="login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="login-refresh"),
    path("me/", MeView.as_view(), name="me"),
] + router.urls
