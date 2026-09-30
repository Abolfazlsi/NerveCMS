import { useEffect, useState, useCallback } from "react";
import { Plus, History } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Select, Input, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { MOVEMENT_TYPE, canWrite } from "../utils/constants";
import { formatDateTime, formatNumber } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

const emptyForm = {
  warehouse: "",
  product: "",
  movement_type: "in",
  quantity: 1,
  reason: "",
};

const MOVEMENT_TYPE_OPTIONS = [
  { value: "in", label: "ورود به انبار" },
  { value: "out", label: "خروج از انبار" },
  { value: "adjustment", label: "تنظیم دقیق موجودی (شمارش)" },
];

export default function StockMovementsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load dropdown sources once on mount.
  useEffect(() => {
    collectAll(inventoryApi.listProducts)
      .then(setProducts)
      .catch(() => {});
    collectAll(inventoryApi.listWarehouses)
      .then(setWarehouses)
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listMovements({
        product: productFilter || undefined,
        page,
      })
      .then((res) => {
        const data = res.data;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCount(data.count ?? results.length);
        setItems(typeFilter ? results.filter((m) => m.movement_type === typeFilter) : results);
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [productFilter, typeFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [productFilter, typeFilter]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openModal = () => {
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.warehouse || !form.product) {
      setError("لطفاً انبار و کالا را انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        product: Number(form.product),
        warehouse: Number(form.warehouse),
        movement_type: form.movement_type,
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      };
      if (form.movement_type === "adjustment") {
        // adjustStock sets the absolute new quantity (not a delta).
        await inventoryApi.adjustStock({
          product: payload.product,
          warehouse: payload.warehouse,
          quantity: payload.quantity,
          reason: payload.reason,
        });
      } else {
        // "in" / "out" create a delta movement.
        await inventoryApi.createMovement(payload);
      }
      toast.success("حرکت ثبت شد");
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(errMsg(err, "ثبت این حرکت ممکن نشد. برای خروج، موجودی کافی نیاز است."));
    } finally {
      setSaving(false);
    }
  };

  const quantityToneClass = (mt) =>
    mt === "in" ? "text-good-600" : mt === "out" ? "text-bad-600" : "text-warn-600";

  const filteredOut = items.length === 0 && count > 0 && !!typeFilter;

  return (
    <div>
      <PageHeader
        title="حرکت‌های موجودی"
        description="تاریخچه کامل ورود، خروج و تنظیم موجودی کالاها"
        actions={
          writable ? (
            <Button onClick={openModal}>
              <Plus className="w-4 h-4" /> حرکت جدید
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="sm:flex-1"
        >
          <option value="">همه کالاها</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه حرکت‌ها</option>
          <option value="in">ورود</option>
          <option value="out">خروج</option>
          <option value="adjustment">تنظیم</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title={filteredOut ? "در این صفحه حرکتی با این نوع وجود ندارد" : "هنوز حرکتی ثبت نشده"}
            description={
              filteredOut
                ? "صفحه بعدی را بررسی کنید یا فیلتر نوع را تغییر دهید."
                : "ورود، خروج یا تنظیم موجودی کالاها برای پیگیری کامل انبار اینجا ثبت می‌شود."
            }
            action={
              writable && !filteredOut ? (
                <Button onClick={openModal}>
                  <Plus className="w-4 h-4" /> حرکت جدید
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">تاریخ</th>
                  <th className="px-5 py-3 font-medium">کالا</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">انبار</th>
                  <th className="px-5 py-3 font-medium">نوع</th>
                  <th className="px-5 py-3 font-medium">مقدار</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">دلیل</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">ثبت توسط</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const mt = MOVEMENT_TYPE[m.movement_type] || { label: m.movement_type, tone: "neutral" };
                  const sign = m.movement_type === "in" ? "+" : m.movement_type === "out" ? "−" : "";
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-ink-700 whitespace-nowrap">
                        {formatDateTime(m.created_at)}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink-900">
                        {m.product_name || "—"}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-ink-500">
                        {m.warehouse_name || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={mt.tone}>{mt.label}</Badge>
                      </td>
                      <td className={`px-5 py-3.5 font-mono whitespace-nowrap ${quantityToneClass(m.movement_type)}`}>
                        {sign}
                        {formatNumber(m.quantity)}
                      </td>
                      <td
                        className="px-5 py-3.5 hidden lg:table-cell text-ink-500 max-w-xs truncate"
                        title={m.reason || ""}
                      >
                        {m.reason || "—"}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500">
                        {m.created_by_name || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          count={count}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          loading={loading}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="ثبت حرکت موجودی">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="انبار" required value={form.warehouse} onChange={update("warehouse")}>
            <option value="">انتخاب انبار…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Select label="کالا" required value={form.product} onChange={update("product")}>
            <option value="">انتخاب کالا…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="نوع حرکت" value={form.movement_type} onChange={update("movement_type")}>
            {MOVEMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            label={form.movement_type === "adjustment" ? "مقدار جدید" : "مقدار"}
            type="number"
            step="0.01"
            min="0"
            required
            value={form.quantity}
            onChange={update("quantity")}
          />
          <Input
            label="دلیل (اختیاری)"
            value={form.reason}
            onChange={update("reason")}
            placeholder="تحویل از تأمین‌کننده، کالای آسیب‌دیده…"
          />
          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : "ثبت حرکت"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
