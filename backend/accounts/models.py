from django.contrib.auth.models import AbstractUser
from django.db import models
from tenants.models import Business


class User(AbstractUser):
    """
    Every user belongs to exactly one Business and has a role that
    determines what they can do within it. `owner` is set automatically
    for whoever signs up and creates the business.
    """

    ROLE_OWNER = "owner"
    ROLE_ADMIN = "admin"
    ROLE_MANAGER = "manager"
    ROLE_STAFF = "staff"

    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_MANAGER, "Manager"),
        (ROLE_STAFF, "Staff"),
    ]

    business = models.ForeignKey(
        Business, on_delete=models.CASCADE, related_name="members", null=True, blank=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STAFF)
    phone = models.CharField(max_length=30, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    @property
    def is_business_admin(self):
        return self.role in (self.ROLE_OWNER, self.ROLE_ADMIN)

    def __str__(self):
        return self.get_full_name() or self.username
