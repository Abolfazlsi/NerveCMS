from datetime import timedelta

from django.db.models import Count, F, Q, Sum, DecimalField
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from customers.models import Customer
from inventory.models import Product
from sales.models import Order, OrderItem
from tasks.models import Task


class DashboardSummaryView(APIView):
    """
    GET /api/dashboard/summary/
    One call that feeds the whole dashboard: headline stats, revenue
    trend, low-stock alerts, upcoming tasks, and a pipeline breakdown.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business
        today = timezone.localdate()
        month_start = today.replace(day=1)
        six_months_ago = (month_start - timedelta(days=180)).replace(day=1)

        customers_qs = Customer.objects.filter(business=business)
        orders_qs = Order.objects.filter(business=business)
        products_qs = Product.objects.filter(business=business, is_active=True)
        tasks_qs = Task.objects.filter(business=business)

        paid_orders = orders_qs.filter(status__in=["paid", "fulfilled"])

        total_revenue = OrderItem.objects.filter(
            order__business=business, order__status__in=["paid", "fulfilled"]
        ).aggregate(
            total=Coalesce(Sum(F("quantity") * F("unit_price")), 0, output_field=DecimalField())
        )["total"]

        revenue_this_month = OrderItem.objects.filter(
            order__business=business,
            order__status__in=["paid", "fulfilled"],
            order__order_date__gte=month_start,
        ).aggregate(
            total=Coalesce(Sum(F("quantity") * F("unit_price")), 0, output_field=DecimalField())
        )["total"]

        # Revenue trend for the last 6 months, for the dashboard chart.
        monthly = (
            OrderItem.objects.filter(
                order__business=business,
                order__status__in=["paid", "fulfilled"],
                order__order_date__gte=six_months_ago,
            )
            .annotate(month=TruncMonth("order__order_date"))
            .values("month")
            .annotate(total=Sum(F("quantity") * F("unit_price"), output_field=DecimalField()))
            .order_by("month")
        )
        revenue_trend = [
            {"month": row["month"].strftime("%b %Y"), "total": float(row["total"] or 0)} for row in monthly
        ]

        low_stock_qs = products_qs.filter(quantity_in_stock__lte=F("reorder_level")).order_by(
            "quantity_in_stock"
        )[:8]
        low_stock = [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "quantity_in_stock": float(p.quantity_in_stock),
                "reorder_level": float(p.reorder_level),
            }
            for p in low_stock_qs
        ]

        upcoming_tasks = (
            tasks_qs.exclude(status=Task.DONE)
            .filter(due_date__isnull=False, due_date__lte=today + timedelta(days=7))
            .order_by("due_date")[:8]
        )
        tasks_data = [
            {
                "id": t.id,
                "title": t.title,
                "due_date": t.due_date,
                "priority": t.priority,
                "is_overdue": t.due_date < today,
                "assigned_to": t.assigned_to.get_full_name() if t.assigned_to else None,
            }
            for t in upcoming_tasks
        ]

        pipeline = list(
            customers_qs.values("status").annotate(count=Count("id")).order_by("status")
        )

        top_products = (
            OrderItem.objects.filter(
                order__business=business, order__status__in=["paid", "fulfilled"]
            )
            .values("product__name")
            .annotate(
                units_sold=Sum("quantity"),
                revenue=Sum(F("quantity") * F("unit_price"), output_field=DecimalField()),
            )
            .order_by("-revenue")[:5]
        )

        # "Stock pulse": per-category stock health, feeds the signature widget.
        category_health = []
        for cat_row in products_qs.values("category__name").annotate(
            total_products=Count("id"),
            low_stock_count=Count("id", filter=Q(quantity_in_stock__lte=F("reorder_level"))),
        ):
            name = cat_row["category__name"] or "Uncategorised"
            total = cat_row["total_products"] or 1
            healthy_ratio = 1 - (cat_row["low_stock_count"] / total)
            category_health.append(
                {
                    "category": name,
                    "total_products": cat_row["total_products"],
                    "low_stock_count": cat_row["low_stock_count"],
                    "health": round(healthy_ratio * 100),
                }
            )

        return Response(
            {
                "stats": {
                    "total_customers": customers_qs.count(),
                    "new_customers_this_month": customers_qs.filter(
                        created_at__date__gte=month_start
                    ).count(),
                    "total_revenue": float(total_revenue or 0),
                    "revenue_this_month": float(revenue_this_month or 0),
                    "orders_this_month": orders_qs.filter(order_date__gte=month_start).count(),
                    "paid_orders_count": paid_orders.count(),
                    "active_products": products_qs.count(),
                    "low_stock_count": products_qs.filter(
                        quantity_in_stock__lte=F("reorder_level")
                    ).count(),
                    "open_tasks": tasks_qs.exclude(status=Task.DONE).count(),
                },
                "revenue_trend": revenue_trend,
                "low_stock": low_stock,
                "upcoming_tasks": tasks_data,
                "pipeline": pipeline,
                "top_products": list(top_products),
                "category_health": category_health,
            }
        )
