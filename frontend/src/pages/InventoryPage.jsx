import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Package, AlertTriangle, Upload, Trash2, History, Tag, Edit3 } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import ImportCsvModal from "../components/ImportCsvModal";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { MOVEMENT_TYPE, isAdmin, canWrite } from "../utils/constants";
import { formatCurrency, formatDateTime, formatNumber } from "../utils/format";

const PAGE_SIZE = 25;

const emptyForm = {
  name: "", sku: "", category: "", unit: "unit", cost_price: 0, unit_price: 0,
  reorder_level: 10, description: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [catSaving, setCatSaving] = useState(false);
  const [catToDelete, setCatToDelete] = useState(null);
  const [catDeleting, setCatDeleting] = useState(false);

  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ movement_type: "in", warehouse: "", quantity: 1, reason: "" });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);
  const [warehouses, setWarehouses] = useState([]);

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
        page,
      })
      .then((res) => {
        setProducts(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .finally(() => setLoading(false));
  }, [search, categoryFilter, lowStockOnly, page]);

  useEffect(() => {
    loadCategories();
    inventoryApi.listWarehouses({}).then((res) => setWarehouses(res.data.results ?? res.data)).catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(1); }, [search, categoryFilter, lowStockOnly]);

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
        toast.success("محصول به‌روز شد.");
      } else {
        await inventoryApi.createProduct(payload);
        toast.success("محصول اضافه شد.");
      }
      setModalOpen(false);
      load();
      loadCategories();
    } catch (err) {
      setError(errMsg(err, "ذخیره این محصول ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustForm.warehouse) {
      setAdjustError("لطفاً انبار را انتخاب کنید.");
      return;
    }
    setAdjustSaving(true);
    setAdjustError("");
    try {
      if (adjustForm.movement_type === "adjustment") {
        await inventoryApi.adjustStock({
          product: adjustModal.id,
          warehouse: Number(adjustForm.warehouse),
          quantity: Number(adjustForm.quantity),
          reason: adjustForm.reason,
        });
      } else {
        await inventoryApi.createMovement({
          product: adjustModal.id,
          warehouse: Number(adjustForm.warehouse),
          movement_type: adjustForm.movement_type,
          quantity: Number(adjustForm.quantity),
          reason: adjustForm.reason,
        });
      }
      toast.success("موجودی به‌روز شد.");
      setAdjustModal(null);
      setAdjustForm({ movement_type: "in", warehouse: "", quantity: 1, reason: "" });
      load();
    } catch (err) {
      setAdjustError(errMsg(err, "ثبت این حرکت ممکن نشد. برای خروج، موجودی کافی نیاز است."));
    } finally {
      setAdjustSaving(false);
    }
  };

  // Categories
  const openCatCreate = () => {
    setCatEditing(null);
    setCatForm({ name: "", description: "" });
    setCatModalOpen(true);
  };
  const openCatEdit = (c) => {
    setCatEditing(c);
    setCatForm({ name: c.name, description: c.description || "" });
    setCatModalOpen(true);
  };
  const submitCategory = async (e) => {
    e.preventDefault();
    setCatSaving(true);
    try {
      if (catEditing) await inventoryApi.updateCategory(catEditing.id, catForm);
      else await inventoryApi.createCategory(catForm);
      toast.success(catEditing ? "دسته‌بندی به‌روز شد." : "دسته‌بندی اضافه شد.");
      setCatModalOpen(false);
      loadCategories();
    } catch (err) {
      toast.error(errMsg(err, "ذخیره دسته‌بندی ناموفق بود."));
    } finally {
      setCatSaving(false);
    }
  };
  const confirmDeleteCat = async () => {
    setCatDeleting(true);
    try {
      await inventoryApi.removeCategory(catToDelete.id);
      toast.success("دسته‌بندی حذف شد.");
      setCatToDelete(null);
      loadCategories();
    } catch (e) {
      toast.error(errMsg(e, "حذف دسته‌بندی ناموفق بود. ممکن است محصولاتی به آن متصل باشند."));
    } finally {
      setCatDeleting(false);
    }
  };

  // History
  const openHistory = async (product) => {
    setHistoryFor(product);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const { data } = await inventoryApi.listMovements({ product: product.id, page_size: 50 });
      setHistory(data.results ?? data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری تاریخچه ناموفق بود."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await inventoryApi.removeProduct(toDelete.id);
      toast.success("محصول حذف شد.");
      setToDelete(null);
      load();
      loadCategories();
    } catch (e) {
      toast.error(errMsg(e, "حذف محصول ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="انبار"
        description="پیگیری محصولات، سطح موجودی و هشدارهای سفارش مجدد"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4" /> وارد کردن CSV</Button>
            <Button variant="outline" onClick={openCatCreate}><Tag className="w-4 h-4" /> دسته‌بندی‌ها</Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> افزودن محصول</Button>
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
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            lowStockOnly ? "bg-warn-100 border-warn-500 text-warn-600" : "bg-white border-ink-300 text-ink-700 hover:bg-ink-100"
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
            action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> افزودن محصول</Button>}
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
                        <span className="font-mono text-ink-900">{formatNumber(p.quantity_in_stock)}</span>
                        {p.is_low_stock && <Badge tone="warn">کمبود</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell font-mono text-ink-700">{formatCurrency(p.unit_price)}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-ink-700">{formatCurrency(p.stock_value)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openHistory(p)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="تاریخچه"><History className="w-4 h-4" /></button>
                        {writable && (
                          <button onClick={() => setAdjustModal(p)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="تنظیم موجودی"><Edit3 className="w-4 h-4" /></button>
                        )}
                        {writable && (
                          <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="ویرایش"><Package className="w-4 h-4" /></button>
                        )}
                        {admin && (
                          <button onClick={() => setToDelete(p)} className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} />
      </Card>

      {/* Product create/edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "ویرایش محصول" : "افزودن محصول"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="نام محصول" required value={form.name} onChange={update("name")} />
            <Input label="کد کالا (SKU)" required value={form.sku} onChange={update("sku")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="دسته‌بندی" value={form.category} onChange={update("category")}>
              <option value="">بدون دسته‌بندی</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="واحد" value={form.unit} onChange={update("unit")} placeholder="عدد، کیلوگرم، جعبه…" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="قیمت تمام‌شده" type="number" step="0.01" value={form.cost_price} onChange={update("cost_price")} />
            <Input label="قیمت فروش" type="number" step="0.01" value={form.unit_price} onChange={update("unit_price")} />
            <Input label="حد سفارش مجدد" type="number" step="0.01" value={form.reorder_level} onChange={update("reorder_level")} />
          </div>
          <Input label="توضیحات" value={form.description} onChange={update("description")} />
          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "افزودن محصول"}</Button>
          </div>
        </form>
      </Modal>

      {/* Stock adjustment */}
      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`تنظیم موجودی — ${adjustModal?.name || ""}`} width="max-w-md">
        <form onSubmit={submitAdjustment} className="space-y-4">
          <p className="text-sm text-ink-500">
            موجودی فعلی: <span className="font-mono text-ink-900">{formatNumber(adjustModal?.quantity_in_stock)}</span> {adjustModal?.unit}
          </p>
          <Select label="انبار" required value={adjustForm.warehouse} onChange={(e) => setAdjustForm((f) => ({ ...f, warehouse: e.target.value }))}>
            <option value="">انتخاب انبار…</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Select label="نوع حرکت" value={adjustForm.movement_type} onChange={(e) => setAdjustForm((f) => ({ ...f, movement_type: e.target.value }))}>
            <option value="in">ورود به انبار (تأمین مجدد)</option>
            <option value="out">خروج از انبار (ضایعات / خسارت)</option>
            <option value="adjustment">تنظیم دقیق موجودی (شمارش)</option>
          </Select>
          <Input
            label={adjustForm.movement_type === "adjustment" ? "مقدار جدید" : "مقدار"}
            type="number" step="0.01" required
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <Input label="دلیل (اختیاری)" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} placeholder="تحویل از تأمین‌کننده، کالای آسیب‌دیده…" />
          {adjustError && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{adjustError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAdjustModal(null)}>انصراف</Button>
            <Button type="submit" disabled={adjustSaving}>{adjustSaving ? "در حال ذخیره…" : "ذخیره"}</Button>
          </div>
        </form>
      </Modal>

      {/* Category modal (create/edit + list with delete) */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={catEditing ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی"}>
        <form onSubmit={submitCategory} className="space-y-4">
          <Input label="نام" required value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="توضیحات" value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="rounded-xl border border-ink-100 max-h-40 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-ink-500 p-3">هنوز دسته‌بندی وجود ندارد.</p>
            ) : categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b border-ink-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">{c.product_count} محصول</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openCatEdit(c)} className="w-7 h-7 rounded-lg hover:bg-ink-100 text-ink-500 flex items-center justify-center" aria-label="ویرایش"><Edit3 className="w-3.5 h-3.5" /></button>
                  {admin && <button onClick={() => setCatToDelete(c)} className="w-7 h-7 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCatModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={catSaving}>{catSaving ? "در حال ذخیره…" : catEditing ? "ذخیره" : "افزودن"}</Button>
          </div>
        </form>
      </Modal>

      {/* Movement history drawer */}
      <Drawer open={!!historyFor} onClose={() => setHistoryFor(null)} title={historyFor ? `تاریخچه موجودی — ${historyFor.name}` : ""}>
        {historyLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">موجودی فعلی: <span className="font-mono text-ink-900">{formatNumber(historyFor?.quantity_in_stock)}</span> {historyFor?.unit}</p>
            {history.length === 0 ? (
              <EmptyState icon={History} title="حرکتی ثبت نشده" description="هنوز ورود یا خروج موجودی برای این محصول ثبت نشده است." />
            ) : (
              <div className="space-y-2">
                {history.map((m) => {
                  const mt = MOVEMENT_TYPE[m.movement_type] || { label: m.movement_type, tone: "neutral" };
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <Badge tone={mt.tone}>{mt.label}</Badge>
                        <div>
                          <p className="text-sm font-mono text-ink-900">{formatNumber(m.quantity)}</p>
                          <p className="text-xs text-ink-500">{m.warehouse_name} • {formatDateTime(m.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-ink-500">{m.created_by_name}</p>
                        {m.reason && <p className="text-xs text-ink-700 mt-0.5">{m.reason}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف محصول"
        message={`آیا از حذف محصول «${toDelete?.name}» مطمئن هستید؟`}
        confirmText="حذف"
      />
      <ConfirmDialog
        open={!!catToDelete}
        onClose={() => setCatToDelete(null)}
        onConfirm={confirmDeleteCat}
        loading={catDeleting}
        title="حذف دسته‌بندی"
        message={`آیا از حذف دسته‌بندی «${catToDelete?.name}» مطمئن هستید؟`}
        confirmText="حذف"
      />

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
