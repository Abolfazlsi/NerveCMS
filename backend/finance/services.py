from django.db import transaction, models
from django.utils import timezone
from datetime import date
from finance.models import Invoice, Payment, Expense
from sales.models import Order
from django.db.models.functions import TruncDate
from django.db.models.functions import TruncMonth


@transaction.atomic
def create_invoice_from_order(order):
    order = (
        Order.objects
        .select_for_update()
        .prefetch_related("items")
        .get(pk=order.pk)
    )

    if order.status == Order.CANCELLED:
        raise ValueError(
            "برای سفارش لغوشده نمی‌توان فاکتور ایجاد کرد."
        )

    if not order.items.exists():
        raise ValueError(
            "برای سفارش بدون کالا نمی‌توان فاکتور ایجاد کرد."
        )

    if hasattr(order, "invoice"):
        raise ValueError(
            "این سفارش قبلاً فاکتور دارد."
        )

    subtotal = order.total_amount
    discount = 0
    tax = 0
    total = subtotal - discount + tax

    invoice = Invoice.objects.create(
        business=order.business,
        order=order,
        invoice_number=generate_invoice_number(order.business_id),
        status=Invoice.DRAFT,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        total=total,
        created_by=order.created_by,
    )

    return invoice


def generate_invoice_number(business_id):
    last_invoice = (
        Invoice.objects
        .filter(business_id=business_id)
        .order_by("-id")
        .first()
    )

    next_number = 1 if not last_invoice else last_invoice.id + 1

    return f"INV-{business_id}-{next_number:05d}"


@transaction.atomic
def issue_invoice(invoice):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status != Invoice.DRAFT:
        raise ValueError(
            "فقط فاکتورهای پیش‌نویس قابل صدور هستند."
        )

    invoice.status = Invoice.ISSUED
    invoice.issued_at = timezone.now()

    invoice.save(
        update_fields=[
            "status",
            "issued_at",
            "updated_at",
        ]
    )

    return invoice


@transaction.atomic
def create_payment(
        invoice,
        amount,
        payment_method,
        paid_at,
        reference_number="",
        created_by=None,
):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status not in [
        Invoice.ISSUED,
        Invoice.PAID,
    ]:
        raise ValueError(
            "فقط فاکتورهای صادرشده قابل پرداخت هستند."
        )

    if amount <= 0:
        raise ValueError(
            "مبلغ پرداخت باید بیشتر از صفر باشد."
        )

    paid_amount = (
            invoice.payments.aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    remaining_amount = invoice.total - paid_amount

    if amount > remaining_amount:
        raise ValueError(
            f"مبلغ پرداخت نمی‌تواند بیشتر از مانده فاکتور باشد. "
            f"مانده: {remaining_amount}"
        )

    payment = Payment.objects.create(
        business=invoice.business,
        invoice=invoice,
        amount=amount,
        payment_method=payment_method,
        reference_number=reference_number,
        paid_at=paid_at,
        created_by=created_by,
    )

    new_paid_amount = paid_amount + amount

    if new_paid_amount >= invoice.total:
        invoice.status = Invoice.PAID
        invoice.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

    return payment


@transaction.atomic
def cancel_invoice(invoice):
    invoice = (
        Invoice.objects
        .select_for_update()
        .get(pk=invoice.pk)
    )

    if invoice.status == Invoice.PAID:
        raise ValueError(
            "فاکتور پرداخت‌شده قابل لغو نیست."
        )

    if invoice.status == Invoice.CANCELLED:
        raise ValueError(
            "این فاکتور قبلاً لغو شده است."
        )

    invoice.status = Invoice.CANCELLED

    invoice.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    return invoice


def get_financial_summary(business):
    total_sales = (
            Invoice.objects
            .filter(
                business=business,
                status__in=[
                    Invoice.ISSUED,
                    Invoice.PAID,
                ],
            )
            .aggregate(
                total=models.Sum("total")
            )["total"]
            or 0
    )

    total_payments = (
            Payment.objects
            .filter(
                business=business,
            )
            .aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    total_expenses = (
            Expense.objects
            .filter(
                business=business,
            )
            .aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    unpaid_amount = (
            Invoice.objects
            .filter(
                business=business,
                status=Invoice.ISSUED,
            )
            .aggregate(
                total=models.Sum("total")
            )["total"]
            or 0
    )

    net_profit = total_payments - total_expenses

    return {
        "total_sales": total_sales,
        "total_payments": total_payments,
        "total_expenses": total_expenses,
        "unpaid_amount": unpaid_amount,
        "net_profit": net_profit,
    }


def get_financial_report(business, start_date, end_date):
    total_sales = (
            Invoice.objects
            .filter(
                business=business,
                status__in=[
                    Invoice.ISSUED,
                    Invoice.PAID,
                ],
                issued_at__date__range=[
                    start_date,
                    end_date,
                ],
            )
            .aggregate(
                total=models.Sum("total")
            )["total"]
            or 0
    )

    total_payments = (
            Payment.objects
            .filter(
                business=business,
                paid_at__date__range=[
                    start_date,
                    end_date,
                ],
            )
            .aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    total_expenses = (
            Expense.objects
            .filter(
                business=business,
                expense_date__range=[
                    start_date,
                    end_date,
                ],
            )
            .aggregate(
                total=models.Sum("amount")
            )["total"]
            or 0
    )

    net_profit = total_payments - total_expenses

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_sales": total_sales,
        "total_payments": total_payments,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
    }


def get_daily_financial_report(
        business,
        start_date,
        end_date,
):
    sales = (
        Invoice.objects
        .filter(
            business=business,
            status__in=[
                Invoice.ISSUED,
                Invoice.PAID,
            ],
            issued_at__date__range=[
                start_date,
                end_date,
            ],
        )
        .annotate(
            day=TruncDate("issued_at")
        )
        .values("day")
        .annotate(
            total=models.Sum("total")
        )
        .order_by("day")
    )

    payments = (
        Payment.objects
        .filter(
            business=business,
            paid_at__date__range=[
                start_date,
                end_date,
            ],
        )
        .annotate(
            day=TruncDate("paid_at")
        )
        .values("day")
        .annotate(
            total=models.Sum("amount")
        )
    )

    expenses = (
        Expense.objects
        .filter(
            business=business,
            expense_date__range=[
                start_date,
                end_date,
            ],
        )
        .values("expense_date")
        .annotate(
            total=models.Sum("amount")
        )
    )

    sales_map = {
        item["day"]: item["total"]
        for item in sales
    }

    payments_map = {
        item["day"]: item["total"]
        for item in payments
    }

    expenses_map = {
        item["expense_date"]: item["total"]
        for item in expenses
    }

    result = []

    current_date = start_date

    while current_date <= end_date:
        daily_sales = sales_map.get(current_date, 0)
        daily_payments = payments_map.get(current_date, 0)
        daily_expenses = expenses_map.get(current_date, 0)

        result.append({
            "date": current_date,
            "sales": daily_sales,
            "payments": daily_payments,
            "expenses": daily_expenses,
            "net_profit": (
                    daily_payments - daily_expenses
            ),
        })

        current_date += date.resolution

    return result


def get_monthly_financial_report(
        business,
        start_date,
        end_date,
):
    sales = (
        Invoice.objects
        .filter(
            business=business,
            status__in=[
                Invoice.ISSUED,
                Invoice.PAID,
            ],
            issued_at__date__range=[
                start_date,
                end_date,
            ],
        )
        .annotate(
            month=TruncMonth("issued_at")
        )
        .values("month")
        .annotate(
            total=models.Sum("total")
        )
        .order_by("month")
    )

    payments = (
        Payment.objects
        .filter(
            business=business,
            paid_at__date__range=[
                start_date,
                end_date,
            ],
        )
        .annotate(
            month=TruncMonth("paid_at")
        )
        .values("month")
        .annotate(
            total=models.Sum("amount")
        )
    )

    expenses = (
        Expense.objects
        .filter(
            business=business,
            expense_date__range=[
                start_date,
                end_date,
            ],
        )
        .annotate(
            month=TruncMonth("expense_date")
        )
        .values("month")
        .annotate(
            total=models.Sum("amount")
        )
    )

    sales_map = {
        item["month"].replace(day=1): item["total"]
        for item in sales
    }

    payments_map = {
        item["month"].replace(day=1): item["total"]
        for item in payments
    }

    expenses_map = {
        item["month"].replace(day=1): item["total"]
        for item in expenses
    }

    result = []

    current_date = start_date.replace(day=1)
    end_month = end_date.replace(day=1)

    while current_date <= end_month:
        monthly_sales = sales_map.get(current_date, 0)
        monthly_payments = payments_map.get(current_date, 0)
        monthly_expenses = expenses_map.get(current_date, 0)

        result.append({
            "month": current_date,
            "sales": monthly_sales,
            "payments": monthly_payments,
            "expenses": monthly_expenses,
            "net_profit": (
                    monthly_payments - monthly_expenses
            ),
        })

        if current_date.month == 12:
            current_date = current_date.replace(
                year=current_date.year + 1,
                month=1,
            )
        else:
            current_date = current_date.replace(
                month=current_date.month + 1,
            )

    return result
