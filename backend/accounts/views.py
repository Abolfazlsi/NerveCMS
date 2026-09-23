from django.contrib.auth import get_user_model
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from tenants.models import Business
from .permissions import IsOwnerOrAdmin
from .serializers import (
    BusinessSignupSerializer,
    BusinessTokenObtainPairSerializer,
    UserCreateSerializer,
    UserSerializer,
)

User = get_user_model()


class BusinessTokenObtainPairView(TokenObtainPairView):
    serializer_class = BusinessTokenObtainPairSerializer


class SignupView(APIView):
    """POST /api/auth/signup/  -> creates a Business + its owner user."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BusinessSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, business = serializer.save()
        return Response(
            {
                "user": UserSerializer(user).data,
                "business": {
                    "id": business.id,
                    "name": business.name,
                    "slug": business.slug,
                    "industry": business.industry,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/auth/me/ - the logged in user's own profile."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class TeamViewSet(viewsets.ModelViewSet):
    """
    Manage the staff belonging to the current business.
    List/retrieve open to any authenticated business member; create/update/
    delete restricted to owner/admin so staff can't promote themselves.
    """

    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOwnerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return User.objects.filter(business=self.request.user.business).order_by("first_name", "username")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_destroy(self, instance):
        if instance.role == User.ROLE_OWNER:
            raise ValueError("Cannot remove the business owner.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])
