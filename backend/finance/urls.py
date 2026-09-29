from django.urls import path
from rest_framework.routers import DefaultRouter

from finance.views import InvoiceViewSet, PaymentViewSet, ExpenseViewSet, FinancialSummaryView, FinancialReportView, \
    DailyFinancialReportView, MonthlyFinancialReportView

router = DefaultRouter()

router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentViewSet, basename="payment")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = [
      path("reports/summary/", FinancialSummaryView.as_view(), name="financial-summary"),
      path("reports/financial/", FinancialReportView.as_view(), name="financial-report"),
      path("reports/daily/", DailyFinancialReportView.as_view(), name="daily-financial-report"),
      path("reports/monthly/", MonthlyFinancialReportView.as_view(), name="monthly-financial-report")

] + router.urls
