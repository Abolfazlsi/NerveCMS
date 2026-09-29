from rest_framework import serializers
from .models import Category, Product, StockMovement, Warehouse, Purchase, PurchaseItem, Supplier, StockTransfer, \
    PurchaseReturnItem, PurchaseReturn, WarehouseStock
from decimal import Decimal


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "product_count"]
        read_only_fields = ["id"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "description", "category", "category_name", "unit",
            "cost_price", "unit_price", "quantity_in_stock", "reorder_level",
            "is_low_stock", "stock_value", "image", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "quantity_in_stock", "created_at", "updated_at"]

    def validate_category(self, value):
        request = self.context.get("request")

        if request and value and value.business_id != request.user.business_id:
            raise serializers.ValidationError(
                "این دسته‌بندی متعلق به کسب‌وکار شما نیست."
            )

        return value


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    warehouse_name = serializers.CharField(
        source="warehouse.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
    )

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "warehouse",
            "warehouse_name",
            "movement_type",
            "quantity",
            "reason",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        business_id = request.user.business_id

        product = attrs.get("product")
        warehouse = attrs.get("warehouse")

        if product and product.business_id != business_id:
            raise serializers.ValidationError({
                "product": "این محصول متعلق به کسب‌وکار شما نیست."
            })

        if warehouse and warehouse.business_id != business_id:
            raise serializers.ValidationError({
                "warehouse": "این انبار متعلق به کسب‌وکار شما نیست."
            })

        if product and warehouse:
            if product.business_id != warehouse.business_id:
                raise serializers.ValidationError({
                    "warehouse": "محصول و انبار باید متعلق به یک کسب‌وکار باشند."
                })

        return attrs


class StockTransferSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    source_warehouse_name = serializers.CharField(
        source="source_warehouse.name",
        read_only=True,
    )

    destination_warehouse_name = serializers.CharField(
        source="destination_warehouse.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
    )

    class Meta:
        model = StockTransfer

        fields = [
            "id",
            "product",
            "product_name",
            "source_warehouse",
            "source_warehouse_name",
            "destination_warehouse",
            "destination_warehouse_name",
            "quantity",
            "status",
            "reason",
            "created_by",
            "created_by_name",
            "created_at",
            "completed_at",
        ]

        read_only_fields = [
            "id",
            "status",
            "created_by",
            "created_by_name",
            "created_at",
            "completed_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        business_id = request.user.business_id

        product = attrs.get("product")
        source = attrs.get("source_warehouse")
        destination = attrs.get("destination_warehouse")
        quantity = attrs.get("quantity")

        if product and product.business_id != business_id:
            raise serializers.ValidationError({
                "product": "این محصول متعلق به کسب‌وکار شما نیست."
            })

        if source and source.business_id != business_id:
            raise serializers.ValidationError({
                "source_warehouse": "انبار مبدأ متعلق به کسب‌وکار شما نیست."
            })

        if destination and destination.business_id != business_id:
            raise serializers.ValidationError({
                "destination_warehouse": "انبار مقصد متعلق به کسب‌وکار شما نیست."
            })

        if source and destination and source == destination:
            raise serializers.ValidationError({
                "destination_warehouse":
                    "انبار مبدأ و مقصد نمی‌توانند یکسان باشند."
            })

        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({
                "quantity": "مقدار انتقال باید بیشتر از صفر باشد."
            })

        return attrs


class PurchaseItemSerializer(serializers.ModelSerializer):
    total_price = serializers.ReadOnlyField()

    class Meta:
        model = PurchaseItem
        fields = [
            "id",
            "product",
            "quantity",
            "purchase_price",
            "total_price",
        ]

    def validate_product(self, value):
        request = self.context.get("request")

        if request and value.business_id != request.user.business_id:
            raise serializers.ValidationError("این محصوی متعلق به کسب و کار شما نیست!")

        return value


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)

    subtotal = serializers.ReadOnlyField()
    total_amount = serializers.ReadOnlyField()

    class Meta:
        model = Purchase
        fields = [
            "id",
            "supplier",
            "warehouse",
            "purchase_number",
            "purchase_date",
            "status",
            "discount",
            "tax",
            "notes",
            "subtotal",
            "total_amount",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        business_id = request.user.business_id

        supplier = attrs.get("supplier")
        warehouse = attrs.get("warehouse")

        if supplier and supplier.business_id != business_id:
            raise serializers.ValidationError({
                "supplier": "این تأمین‌کننده متعلق به کسب‌وکار شما نیست."
            })

        if warehouse and warehouse.business_id != business_id:
            raise serializers.ValidationError({
                "warehouse": "این انبار متعلق به کسب‌وکار شما نیست."
            })

        items = self.initial_data.get("items")

        if not items:
            raise serializers.ValidationError({
                "items": "خرید باید حداقل یک محصول داشته باشد."
            })
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        purchase = Purchase.objects.create(
            **validated_data,
        )

        for item_data in items_data:
            PurchaseItem.objects.create(
                purchase=purchase,
                **item_data,
            )

        return purchase


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "company_name",
            "phone",
            "email",
            "address",
            "tax_number",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = ["id", "created_at", "updated_at"]


class WarehouseSerializer(serializers.ModelSerializer):
    stock_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Warehouse
        fields = [
            "id",
            "name",
            "code",
            "address",
            "is_active",
            "is_default",
            "stock_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "stock_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.business_id:
            raise serializers.ValidationError(
                "کاربر به هیچ کسب‌وکاری متصل نیست."
            )

        return attrs


class StockAdjustmentSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all()
    )

    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all()
    )

    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    reason = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        business_id = request.user.business_id

        product = attrs["product"]
        warehouse = attrs["warehouse"]

        if product.business_id != business_id:
            raise serializers.ValidationError({
                "product": "این محصول متعلق به کسب‌وکار شما نیست."
            })

        if warehouse.business_id != business_id:
            raise serializers.ValidationError({
                "warehouse": "این انبار متعلق به کسب‌وکار شما نیست."
            })

        return attrs


class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    class Meta:
        model = PurchaseReturnItem
        fields = [
            "id",
            "product",
            "product_name",
            "quantity",
        ]
        read_only_fields = ["id"]


class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(many=True)

    class Meta:
        model = PurchaseReturn
        fields = [
            "id",
            "purchase",
            "warehouse",
            "reason",
            "status",
            "created_by",
            "created_at",
            "completed_at",
            "items",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "created_at",
            "completed_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        business_id = request.user.business_id

        purchase = attrs["purchase"]
        warehouse = attrs["warehouse"]

        if purchase.business_id != business_id:
            raise serializers.ValidationError({
                "purchase": "این خرید متعلق به کسب‌وکار شما نیست."
            })

        if warehouse.business_id != business_id:
            raise serializers.ValidationError({
                "warehouse": "این انبار متعلق به کسب‌وکار شما نیست."
            })

        for item in self.initial_data.get("items", []):
            product_id = item.get("product")

            product = Product.objects.filter(
                id=product_id,
                business_id=business_id,
            ).first()

            if not product:
                raise serializers.ValidationError({
                    "items": "یکی از محصولات متعلق به کسب‌وکار شما نیست."
                })

            if Decimal(str(item.get("quantity", 0))) <= 0:
                raise serializers.ValidationError({
                    "items": "مقدار مرجوعی باید بیشتر از صفر باشد."
                })

        return attrs


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )
    warehouse_name = serializers.CharField(
        source="warehouse.name",
        read_only=True,
    )

    class Meta:
        model = WarehouseStock
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "product",
            "product_name",
            "quantity",
            "reorder_level",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "quantity",
            "updated_at",
        ]
