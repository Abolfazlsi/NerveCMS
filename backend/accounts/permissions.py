from rest_framework import permissions


class IsBusinessMember(permissions.BasePermission):
    """Base permission: user must belong to a business."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.business_id)

    def has_object_permission(self, request, view, obj):
        business_id = getattr(obj, "business_id", None)
        return business_id == request.user.business_id


class IsAdminOrReadOnly(permissions.BasePermission):
    """Staff can read; only owner/admin/manager can write. Deletes require admin+."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.business_id):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == "DELETE":
            return request.user.role in ("owner", "admin")
        return request.user.role in ("owner", "admin", "manager")


class IsOwnerOrAdmin(permissions.BasePermission):
    """Restricted to owner/admin only, e.g. managing staff accounts or business settings."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.business_id
            and request.user.role in ("owner", "admin")
        )
