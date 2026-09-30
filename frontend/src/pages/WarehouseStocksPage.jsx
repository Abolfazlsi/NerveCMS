import { useEffect, useState, useCallback } from "react";
import { Boxes, Edit3, AlertTriangle } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { canWrite } from "../utils/constants";
import { formatDateTime, formatNumber } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

export default function WarehouseStocksPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [page, setPage] = useState(1);

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  const [editModal, setEditModal] = useState(null); // warehouse-stock row being edited
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listWarehouseStocks({
        warehouse: warehouseFilter || undefined,
        product: productFilter || undefined,
        page,
      })
      .then((res) => {
        setItems(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .catch(() => {
        // clear stale rows on filter/page failure so the empty state shows
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [warehouseFilter, productFilter, page]);

  // Load dropdown sources (warehouses + products) once on mount.
  // collectAll walks every DRF page so the dropdowns include the full set.
  useEffect(() => {
    Promise.all([
      collectAll(inventoryApi.listWarehouses),
      collectAll(inventoryApi.listProducts),
    ])
      .then(([ws, ps]) => {
        setWarehouses(ws);
        setProducts(ps);
      })
      .catch(() => {
        /* silent — dropdowns just stay empty, user can still see the table */
      });
  }, []);

  // Debounced reload on filter/page change (matches other list pages).
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [warehouseFilter, productFilter]);

  const openEdit = (row) => {
    setEditModal(row);
    setEditValue(String(row.reorder_level ?? 0));
  };

  const closeEdit = () => {
    setEditModal(null);
    setEditValue("");
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    const value = Number(editValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("مقدار نامعتبر است.");
      return;
    }
    setEditSaving(true);
    try {
      // NOTE: quantity is READ-ONLY on the backend — only reorder_level is writable.
      await inventoryApi.updateWarehouseStock(editModal.id, { reorder_level: value });
      toast.success("حد سفارش مجدد به‌روز شد.");
      closeEdit();
      load();
    } catch (err) {
      toast.error(errMsg(err, "ذخیره حد سفارش مجدد ناموفق بود."));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="موجودی انبارها"
        description="مشاهده سطح موجودی هر کالا در هر انبار و تنظیم حد سفارش مجدد"
      />
      <p className="text-xs text-ink-500 -mt-3 mb-5 leading-relaxed">
        توجه: سطح موجودی تنها از طریق حرکت‌های انبار (در صفحه انبار)، خریدها و انتقال‌ها تغییر
        می‌کند؛ این صفحه صرفاً برای مشاهده و تنظیم حد سفارش مجدد است.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه انبارها</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </Select>
        <Select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه کالاها</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="موجودی‌ای ثبت نشده"
            description="با ثبت حرکت موجودی (ورود کالا، خرید یا انتقال) رکوردهای موجودی ایجاد می‌شوند."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">انبار</th>
                  <th className="px-5 py-3 font-medium">کالا</th>
                  <th className="px-5 py-3 font-medium">موجودی</th>
                  <th className="px-5 py-3 font-medium">حد سفارش مجدد</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">به‌روزرسانی</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const qty = Number(row.quantity);
                  const reorder = Number(row.reorder_level);
                  const low = Number.isFinite(qty) && Number.isFinite(reorder) && qty <= reorder;
                  const sku = row.product_sku || row.sku;
                  return (
                    <tr key={row.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                      <td className="px-5 py-3.5 text-ink-900">{row.warehouse_name}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink-900">{row.product_name}</p>
                        {sku && <p className="text-xs text-ink-500 font-mono">{sku}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${low ? "font-bold text-bad-600" : "text-ink-900"}`}>
                            {formatNumber(row.quantity)}
                          </span>
                          {low && (
                            <Badge tone="warn" className="gap-1">
                              <AlertTriangle className="w-3 h-3" /> کمبود
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-ink-700">{formatNumber(row.reorder_level)}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500">{formatDateTime(row.updated_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end">
                          {writable && (
                            <button
                              onClick={() => openEdit(row)}
                              className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors"
                              aria-label="تنظیم حد سفارش مجدد"
                              title="تنظیم حد سفارش مجدد"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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

      {/* Edit reorder_level modal */}
      <Modal
        open={!!editModal}
        onClose={closeEdit}
        title="تنظیم حد سفارش مجدد"
        width="max-w-md"
      >
        {editModal && (
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-500 mb-1">انبار</p>
                <p className="text-ink-900 font-medium">{editModal.warehouse_name}</p>
              </div>
              <div>
                <p className="text-ink-500 mb-1">کالا</p>
                <p className="text-ink-900 font-medium">{editModal.product_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-ink-500 mb-1">موجودی فعلی</p>
                <p className="font-mono text-ink-900">{formatNumber(editModal.quantity)}</p>
              </div>
            </div>
            <Input
              label="حد سفارش مجدد"
              type="number"
              step="0.01"
              min="0"
              required
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeEdit}>انصراف</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "در حال ذخیره…" : "ذخیره"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
