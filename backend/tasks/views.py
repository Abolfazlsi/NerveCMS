from core.viewsets import BusinessScopedViewSet
from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(BusinessScopedViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        qs = Task.objects.filter(business=self.request.user.business).select_related(
            "assigned_to", "related_customer"
        )
        status = self.request.query_params.get("status")
        assigned_to = self.request.query_params.get("assigned_to")
        if status:
            qs = qs.filter(status=status)
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        return qs.order_by("due_date", "-priority")
