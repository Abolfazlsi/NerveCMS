import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Package, AlertTriangle, ArrowUpDown, Upload } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import ImportCsvModal from "../components/ImportCsvModal";
import { formatCurrency } from "../utils/format";

const emptyForm = {
  name: "", sku: "", category: "", unit: "unit", cost_price: 0, unit_price: 0,
  reorder_level: 10, description: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [adjustModal, setAdjustModal] = useState(null); // محصولی که موجودی‌اش تنظیم می‌شود
  const [adjustForm, setAdjustForm] = useState({ movement_type: "in", quantity: 1, reason: "" });

  const loadCategories = useCallback(() => {
    inventoryApi.listCategories().then((res) => setCategories(res.data.results ?? res.data));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listProducts({
        search: search || undefined,
        category: categoryFilter || undefined,
        low_stock: lowStockOnly ? "true" : undefined,
      })
      .then((res) => setProducts(res.data.results ?? res.data))
      .finally(() => setLoading(false));
  }, [search, categoryFilter, lowStockOnly]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, category: p.category || "", unit: p.unit,
      cost_price: p.cost_price, unit_price: p.unit_price, reorder_level: p.reorder_level,
      description: p.description,
    });
    setError("");
    setModalOpen(true);
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, category: form.category || null };
      if (editing) {
        await inventoryApi.updateProduct(editing.id, payload);
      } else {
        await inventoryApi.createProduct(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const msg =
        err.response?.data?.sku?.[0] ||
        err.response?.data?.detail ||
        "ذخیره این محصول ممکن نشد. لطفاً فیلدها را بررسی کنید و دوباره تلاش کنید.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    try {
      await inventoryApi.createMovement({
        product: adjustModal.id,
        movement_type: adjustForm.movement_type,
        quantity: adjustForm.quantity,
        reason: adjustForm.reason,
      });
      setAdjustModal(null);
      setAdjustForm({ movement_type: "in", quantity: 1, reason: "" });
      load();
    } catch {
      // در حالت ایده‌آل خطا به صورت inline نمایش داده می‌شود؛ اینجا ساده نگه داشته شده
    }
  };

  return (
    <div>
      <PageHeader
        title="انبار"
        description="پیگیری محصولات، سطح موجودی و هشدارهای سفارش مجدد"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> وارد کردن CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> افزودن محصول
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام یا کد کالا…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="sm:w-48">
          <option value="">همه دسته‌ها</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            lowStockOnly
              ? "bg-warn-100 border-warn-500 text-warn-600"
              : "bg-white border-ink-300 text-ink-700 hover:bg-ink-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> کمبود موجودی
        </button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="هنوز محصولی وجود ندارد"
            description="اولین محصول را اضافه کنید تا موجودی را پیگیری کنید."
            action={
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> افزودن محصول
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">محصول</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">دسته‌بندی</th>
                  <th className="px-5 py-3 font-medium">موجودی</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">قیمت فروش</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">ارزش موجودی</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => openEdit(p)}>
                      <p className="font-medium text-ink-900">{p.name}</p>
                      <p className="text-xs text-ink-500 font-mono">{p.sku}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-ink-500">{p.category_name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink-900">{Number(p.quantity_in_stock)}</span>
                        {p.is_low_stock && <Badge tone="warn">کمبود</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell font-mono text-ink-700">
                      {formatCurrency(p.unit_price)}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-ink-700">
                      {formatCurrency(p.stock_value)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setAdjustModal(p)}
                        className="inline-flex items-center gap-1.5 text-brand-500 hover:text-brand-600 text-xs font-medium"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" /> تنظیم موجودی
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "ویرایش محصول" : "افزودن محصول"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="نام محصول" required value={form.name} onChange={update("name")} />
            <Input label="کد کالا (SKU)" required value={form.sku} onChange={update("sku")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="دسته‌بندی" value={form.category} onChange={update("category")}>
              <option value="">بدون دسته‌بندی</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input
              label="واحد"
              value={form.unit}
              onChange={update("unit")}
              placeholder="عدد، کیلوگرم، جعبه…"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="قیمت تمام‌شده"
              type="number"
              step="0.01"
              value={form.cost_price}
              onChange={update("cost_price")}
            />
            <Input
              label="قیمت فروش"
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={update("unit_price")}
            />
            <Input
              label="حد سفارش مجدد"
              type="number"
              step="0.01"
              value={form.reorder_level}
              onChange={update("reorder_level")}
            />
          </div>
          <Input label="توضیحات" value={form.description} onChange={update("description")} />

          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "افزودن محصول"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={`تنظیم موجودی — ${adjustModal?.name || ""}`}
        width="max-w-md"
      >
        <form onSubmit={submitAdjustment} className="space-y-4">
          <p className="text-sm text-ink-500">
            موجودی فعلی:{" "}
            <span className="font-mono text-ink-900">
              {Number(adjustModal?.quantity_in_stock)}
            </span>{" "}
            {adjustModal?.unit}
          </p>
          <Select
            label="نوع حرکت"
            value={adjustForm.movement_type}
            onChange={(e) => setAdjustForm((f) => ({ ...f, movement_type: e.target.value }))}
          >
            <option value="in">ورود به انبار (تأمین مجدد)</option>
            <option value="out">خروج از انبار (ضایعات / خسارت)</option>
            <option value="adjustment">تنظیم دقیق موجودی</option>
          </Select>
          <Input
            label={adjustForm.movement_type === "adjustment" ? "مقدار جدید" : "مقدار"}
            type="number"
            step="0.01"
            required
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <Input
            label="دلیل (اختیاری)"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="تحویل از تأمین‌کننده، کالای آسیب‌دیده…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAdjustModal(null)}>
              انصراف
            </Button>
            <Button type="submit">ذخیره</Button>
          </div>
        </form>
      </Modal>

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="وارد کردن محصولات از فایل CSV"
        columnsHint="ستون‌های قابل تشخیص: name (الزامی)، sku، category، unit، cost_price، unit_price، quantity_in_stock، reorder_level، description. در صورت نبودن SKU به‌صورت خودکار تولید می‌شود. محصولات موجود بر اساس SKU شناسایی می‌شوند تا تکراری ایجاد نشود."
        onImport={inventoryApi.importCsv}
        onDone={load}
      />
    </div>
  );
}