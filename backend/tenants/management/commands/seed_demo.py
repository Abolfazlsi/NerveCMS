import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from tenants.models import Business
from customers.models import Customer, CustomerNote
from inventory.models import Category, Product, StockMovement
from sales.models import Order, OrderItem
from tasks.models import Task

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds a demo business with sample customers, products, orders and tasks."

    def add_arguments(self, parser):
        parser.add_argument("--business-name", default="Demo Trading Co.")
        parser.add_argument("--username", default="demo")
        parser.add_argument("--password", default="demo12345")

    def handle(self, *args, **options):
        name = options["business_name"]
        username = options["username"]
        password = options["password"]

        business, created = Business.objects.get_or_create(name=name, defaults={"industry": "retail"})
        owner, user_created = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@example.com", "business": business, "role": User.ROLE_OWNER},
        )
        if user_created:
            owner.set_password(password)
            owner.business = business
            owner.role = User.ROLE_OWNER
            owner.save()

        staff, _ = User.objects.get_or_create(
            username=f"{username}_staff",
            defaults={"email": f"{username}_staff@example.com", "business": business, "role": User.ROLE_STAFF},
        )
        if _:
            staff.set_password(password)
            staff.save()

        categories = {}
        for cat_name in ["Beverages", "Snacks", "Household", "Electronics"]:
            categories[cat_name], _ = Category.objects.get_or_create(business=business, name=cat_name)

        products = []
        sample_products = [
            ("Sparkling Water 500ml", "Beverages", 1.20, 2.50, 120, 30),
            ("Roasted Almonds 200g", "Snacks", 2.80, 5.50, 8, 20),
            ("All-Purpose Cleaner 1L", "Household", 1.90, 4.20, 45, 15),
            ("USB-C Cable 1m", "Electronics", 2.10, 6.99, 5, 25),
            ("Cold Brew Coffee 330ml", "Beverages", 1.50, 3.20, 60, 20),
            ("Trail Mix 150g", "Snacks", 1.70, 3.80, 3, 20),
        ]
        for pname, cat, cost, price, qty, reorder in sample_products:
            p, _ = Product.objects.get_or_create(
                business=business,
                sku=pname[:3].upper() + str(random.randint(100, 999)),
                defaults=dict(
                    name=pname, category=categories[cat], cost_price=cost, unit_price=price,
                    quantity_in_stock=qty, reorder_level=reorder,
                ),
            )
            products.append(p)

        customer_names = [
            ("Alice Jordan", "active"), ("Priya Nair", "active"), ("Tom Becker", "lead"),
            ("Green Leaf Cafe", "active"), ("Marcus Wells", "lead"), ("Sunrise Retail", "inactive"),
        ]
        customers = []
        for cname, status in customer_names:
            c, _ = Customer.objects.get_or_create(
                business=business, name=cname,
                defaults=dict(
                    email=cname.lower().replace(" ", ".") + "@example.com",
                    status=status, source=random.choice(["referral", "website", "social"]),
                    estimated_value=random.randint(200, 5000), assigned_to=random.choice([owner, staff]),
                ),
            )
            customers.append(c)

        today = timezone.localdate()
        for i in range(10):
            order_date = today - timedelta(days=random.randint(0, 150))
            order = Order.objects.create(
                business=business, customer=random.choice(customers),
                status=random.choice(["paid", "paid", "fulfilled", "pending"]),
                order_date=order_date, created_by=owner,
            )
            for _ in range(random.randint(1, 3)):
                product = random.choice(products)
                OrderItem.objects.create(
                    order=order, product=product,
                    quantity=random.randint(1, 5), unit_price=product.unit_price,
                )

        Task.objects.get_or_create(
            business=business, title="Follow up with Tom Becker",
            defaults=dict(
                assigned_to=staff, priority=Task.HIGH, due_date=today + timedelta(days=2),
                related_customer=customers[2], created_by=owner,
            ),
        )
        Task.objects.get_or_create(
            business=business, title="Reorder Almonds & Trail Mix",
            defaults=dict(assigned_to=owner, priority=Task.MEDIUM, due_date=today + timedelta(days=1), created_by=owner),
        )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded '{business.name}'. Login with username='{username}' password='{password}'."
        ))
