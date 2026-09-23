from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from tenants.models import Business

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "phone", "avatar", "business", "business_name",
            "is_active", "date_joined",
        ]
        read_only_fields = ["id", "business", "date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    """Used by an owner/admin to invite a new staff member into their business."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        request = self.context["request"]
        user = User(**validated_data, business=request.user.business)
        user.set_password(password)
        user.save()
        return user


class BusinessSignupSerializer(serializers.Serializer):
    """
    Creates a brand new Business plus its first user (the owner), all in
    one call. This is the entry point for "sign up my company".
    """

    business_name = serializers.CharField(max_length=150)
    industry = serializers.ChoiceField(choices=Business.INDUSTRY_CHOICES, default="general")
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("That username is already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        business = Business.objects.create(
            name=validated_data["business_name"],
            industry=validated_data.get("industry", "general"),
        )
        user = User(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            business=business,
            role=User.ROLE_OWNER,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user, business


class BusinessTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds business + role info directly into the JWT payload."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["business_id"] = str(user.business_id) if user.business_id else None
        token["business_name"] = user.business.name if user.business else None
        return token
