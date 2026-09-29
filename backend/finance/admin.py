from django.contrib import admin
from .models import Invoice, Payment, Expense

admin.site.register(Invoice)
admin.site.register(Payment)
admin.site.register(Expense)
