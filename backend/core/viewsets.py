from rest_framework import viewsets
from accounts.permissions import IsAdminOrReadOnly


class BusinessScopedViewSet(viewsets.ModelViewSet):
    """
    Every domain model (Customer, Product, Order, Task...) belongs to a
    Business. This base class guarantees:
      - list/retrieve/update/delete can only ever touch rows in the
        caller's own business (hard tenant isolation),
      - create() automatically stamps the new row with the caller's
        business, so the client never has to (and can't) supply it,
      - default permission is read for everyone in the business, write
        for manager/admin/owner, delete for admin/owner.
    Subclasses just set `queryset` (unfiltered) and `serializer_class`.
    """

    permission_classes = [IsAdminOrReadOnly]
    filter_backends = []
    search_fields = []
    ordering_fields = "__all__"

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        extra = {"business": self.request.user.business}
        model = self.get_queryset().model
        field_names = [f.name for f in model._meta.get_fields()]
        if "created_by" in field_names:
            extra["created_by"] = self.request.user
        serializer.save(**extra)
