import { useEffect, useState, useCallback } from "react";
import { Plus, Eye, Send, XCircle, Trash2, FileText, Search } from "lucide-react";
import { financeApi, salesApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { INVOICE_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, isAdmin, canWrite } from "../utils/constants";
import { formatCurrency, formatDateTime } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

export default function InvoicesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // server-side ?status= filter + client-side search on invoice_number
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Create-from-order modal
  const [modalOpen, setModalOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [formOrderId, setFormOrderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Detail drawer
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Action state
  const [issuingId, setIssuingId] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    financeApi
      .listInvoices({ status: statusFilter || undefined, page })
      .then((res) => {
        const data = res.data;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCount(data.count ?? results.length);
        const term = search.trim().toLowerCase();
        if (!term) {
          setItems(results);
        } else {
          setItems(
            results.filter((inv) =>
              String(inv.invoice_number || "").toLowerCase().includes(term)
            )
          );
        }
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, search, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const openCreate = async () => {
    setError("");
    setFormOrderId("");
    setModalOpen(true);
    setOrdersLoading(true);
    try {
      const all = await collectAll(salesApi.list);
      // Backend rejects create-invoice for orders that are cancelled, have no items,
      // or already have an invoice. We surface only paid/fulfilled orders.
      setOrders(all.filter((o) => o.status === "paid" || o.status === "fulfilled"));
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formOrderId) {
      setError("لطفاً یک سفارش را انتخاب کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await financeApi.createInvoiceFromOrder(Number(formOrderId));
      toast.success("فاکتور صادر شد");
      setModalOpen(false);
      load();
    } catch (err) {
      setError(
        errMsg(
          err,
          "صدور فاکتور ممکن نشد. سفارش باید پرداخت‌شده یا تکمیل‌شده و فاقد فاکتور قبلی باشد."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (invoice) => {
    setDetail(invoice);
    setDetailLoading(true);
    setPayments([]);
    setPaymentsLoading(true);
    try {
      const { data } = await financeApi.getInvoice(invoice.id);
      setDetail(data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات فاکتور ناموفق بود."));
    } finally {
      setDetailLoading(false);
    }
    collectAll(financeApi.listPayments, { invoice: invoice.id })
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  };

  const refreshDetail = async (id) => {
    try {
      const { data } = await financeApi.getInvoice(id);
      setDetail(data);
    } catch {
      // keep existing detail if refresh fails
    }
  };

  const issue = async (invoice) => {
    setIssuingId(invoice.id);
    try {
      await financeApi.issueInvoice(invoice.id);
      toast.success("فاکتور صادر شد");
      await load();
      if (detail?.id === invoice.id) await refreshDetail(invoice.id);
    } catch (e) {
      toast.error(errMsg(e, "صدور فاکتور ناموفق بود."));
    } finally {
      setIssuingId(null);
    }
  };

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await financeApi.cancelInvoice(toCancel.id);
      toast.success("فاکتور باطل شد");
      const id = toCancel.id;
      setToCancel(null);
      await load();
      if (detail?.id === id) await refreshDetail(id);
    } catch (e) {
      toast.error(errMsg(e, "ابطال فاکتور ناموفق بود."));
    } finally {
      setCancelling(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await financeApi.removeInvoice(toDelete.id);
      toast.success("فاکتور حذف شد");
      if (detail?.id === toDelete.id) setDetail(null);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف فاکتور ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  const filteredOut = items.length === 0 && count > 0 && !!search.trim();

  return (
    <div>
      <PageHeader
        title="فاکتورها"
        description="صدور فاکتور از سفارش‌ها و پیگیری پرداخت"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> صدور فاکتور
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس شماره فاکتور…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(INVOICE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filteredOut ? "موردی یافت نشد" : "هنوز فاکتوری صادر نشده"}
            description={
              filteredOut
                ? "شماره فاکتور دیگری را جستجو کنید یا فیلتر را تغییر دهید."
                : "برای صدور فاکتور، یک سفارش پرداخت‌شده یا تکمیل‌شده را انتخاب کنید."
            }
            action={
              writable && !filteredOut ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> صدور فاکتور
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">شماره فاکتور</th>
                  <th className="px-5 py-3 font-medium">مشتری</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">سفارش</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">وضعیت پرداخت</th>
                  <th className="px-5 py-3 font-medium text-right">مبلغ کل</th>
                  <th className="px-5 py-3 font-medium text-right hidden lg:table-cell">پرداخت‌شده</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => {
                  const st = INVOICE_STATUS[inv.status] || { label: inv.status_display || inv.status, tone: "neutral" };
                  const ps = PAYMENT_STATUS[inv.payment_status] || { label: inv.payment_status, tone: "neutral" };
                  const canIssue = writable && inv.status === "draft";
                  const canCancel = writable && (inv.status === "draft" || inv.status === "issued");
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                    >
                      <td
                        className="px-5 py-3.5 font-mono text-ink-900 cursor-pointer"
                        onClick={() => openDetail(inv)}
                      >
                        {inv.invoice_number || "—"}
                      </td>
                      <td
                        className="px-5 py-3.5 text-ink-900 cursor-pointer"
                        onClick={() => openDetail(inv)}
                      >
                        {inv.customer_name || "—"}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell font-mono text-ink-700 whitespace-nowrap">
                        {inv.order_number || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <Badge tone={ps.tone}>{ps.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-ink-900 whitespace-nowrap">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-ink-700 whitespace-nowrap hidden lg:table-cell">
                        {formatCurrency(inv.paid_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(inv)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                            aria-label="جزئیات"
                            title="جزئیات"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canIssue && (
                            <button
                              onClick={() => issue(inv)}
                              disabled={issuingId === inv.id}
                              className="w-8 h-8 rounded-lg hover:bg-warn-100 text-ink-500 hover:text-warn-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="صدور فاکتور"
                              title="صدور فاکتور"
                            >
                              {issuingId === inv.id ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => setToCancel(inv)}
                              className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                              aria-label="ابطال فاکتور"
                              title="ابطال فاکتور"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {admin && (
                            <button
                              onClick={() => setToDelete(inv)}
                              className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                              aria-label="حذف"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Create-from-order modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="صدور فاکتور از سفارش"
        width="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <Select
              label="سفارش"
              required
              value={formOrderId}
              onChange={(e) => setFormOrderId(e.target.value)}
            >
              <option value="">انتخاب سفارش…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  سفارش {o.order_number} — {o.customer_name || "—"} ({formatCurrency(o.total_amount)})
                </option>
              ))}
            </Select>
          )}

          <p className="text-xs text-ink-500 bg-ink-100/60 rounded-xl p-3 leading-relaxed">
            صدور فاکتور تنها برای سفارش‌های «پرداخت‌شده» یا «تکمیل‌شده» و فاقد فاکتور
            قبلی امکان‌پذیر است. مبلغ فاکتور از مبلغ کل سفارش کپی می‌شود.
          </p>

          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving || !formOrderId}>
              {saving ? "در حال صدور…" : "صدور فاکتور"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `فاکتور ${detail.invoice_number || ""}` : "فاکتور"}
        footer={
          detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {writable && detail.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => issue(detail)}
                    disabled={issuingId === detail.id}
                  >
                    {issuingId === detail.id ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}{" "}
                    صدور
                  </Button>
                )}
                {writable && (detail.status === "draft" || detail.status === "issued") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setToCancel(detail)}
                  >
                    <XCircle className="w-4 h-4" /> ابطال
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {admin && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setToDelete(detail)}
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailField label="مشتری" value={detail.customer_name} />
              <DetailField label="شماره سفارش" value={detail.order_number} mono />
              <DetailField
                label="وضعیت"
                value={INVOICE_STATUS[detail.status]?.label || detail.status_display || detail.status}
                badge={INVOICE_STATUS[detail.status]?.tone}
              />
              <DetailField
                label="وضعیت پرداخت"
                value={PAYMENT_STATUS[detail.payment_status]?.label || detail.payment_status}
                badge={PAYMENT_STATUS[detail.payment_status]?.tone}
              />
              <DetailField label="تاریخ صدور" value={formatDateTime(detail.issued_at)} />
              <DetailField label="تاریخ ایجاد" value={formatDateTime(detail.created_at)} />
            </div>

            {/* Totals breakdown */}
            <div className="rounded-xl border border-ink-100 overflow-hidden">
              <div className="bg-ink-100/60 px-4 py-2.5">
                <h4 className="font-display font-semibold text-ink-900 text-sm">بازه مبلغ فاکتور</h4>
              </div>
              <div className="divide-y divide-ink-100 text-sm">
                <TotalRow label="جمع کل آیتم‌ها" value={formatCurrency(detail.subtotal)} />
                <TotalRow label="تخفیف" value={`− ${formatCurrency(detail.discount)}`} tone="bad" />
                <TotalRow label="مالیات" value={`+ ${formatCurrency(detail.tax)}`} tone="warn" />
                <TotalRow
                  label="مبلغ نهایی"
                  value={formatCurrency(detail.total)}
                  strong
                />
                <TotalRow
                  label="پرداخت‌شده"
                  value={formatCurrency(detail.paid_amount)}
                  tone="good"
                />
                <TotalRow
                  label="باقی‌مانده"
                  value={formatCurrency(detail.remaining_amount)}
                  tone={Number(detail.remaining_amount) > 0 ? "bad" : "good"}
                />
              </div>
            </div>

            {/* Payments list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-semibold text-ink-900 text-sm">پرداخت‌های این فاکتور</h4>
                {paymentsLoading && <Spinner className="w-4 h-4" />}
              </div>
              {paymentsLoading ? null : payments.length === 0 ? (
                <div className="rounded-xl bg-ink-100/60 p-4 text-sm text-ink-500 text-center">
                  هنوز پرداختی برای این فاکتور ثبت نشده است.
                </div>
              ) : (
                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-100/60 border-b border-ink-100 text-right text-ink-500">
                        <th className="px-3.5 py-2.5 font-medium">مبلغ</th>
                        <th className="px-3.5 py-2.5 font-medium">روش</th>
                        <th className="px-3.5 py-2.5 font-medium hidden sm:table-cell">شماره مرجع</th>
                        <th className="px-3.5 py-2.5 font-medium hidden sm:table-cell">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-ink-100 last:border-0">
                          <td className="px-3.5 py-2.5 font-mono text-ink-900 text-right whitespace-nowrap">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-ink-700">
                            {PAYMENT_METHOD[p.payment_method] || p.payment_method || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 hidden sm:table-cell font-mono text-ink-700">
                            {p.reference_number || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 hidden sm:table-cell text-ink-500 whitespace-nowrap">
                            {formatDateTime(p.paid_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-ink-500">
                ثبت پرداخت جدید از صفحه «پرداخت‌ها» انجام می‌شود.
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={confirmCancel}
        loading={cancelling}
        title="ابطال فاکتور"
        message={`آیا از ابطال فاکتور «${toCancel?.invoice_number || ""}» مطمئن هستید؟ پس از ابطال، این فاکتور قابل صدور مجدد نیست.`}
        confirmText="ابطال"
        tone="danger"
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف فاکتور"
        message={`آیا از حذف فاکتور «${toDelete?.invoice_number || ""}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        tone="danger"
      />
    </div>
  );
}

function DetailField({ label, value, badge, mono }) {
  return (
    <div>
      <p className="text-ink-500 mb-1">{label}</p>
      {badge ? (
        <Badge tone={badge}>{value || "—"}</Badge>
      ) : (
        <p className={`text-ink-900 font-medium ${mono ? "font-mono" : ""}`}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}

function TotalRow({ label, value, tone, strong }) {
  const toneClass =
    tone === "bad"
      ? "text-bad-600"
      : tone === "good"
      ? "text-good-600"
      : tone === "warn"
      ? "text-warn-600"
      : "text-ink-900";
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        strong ? "bg-ink-100/40" : ""
      }`}
    >
      <span className={`${strong ? "font-semibold text-ink-900" : "text-ink-500"}`}>
        {label}
      </span>
      <span
        className={`font-mono ${strong ? "font-semibold text-base" : "font-medium"} ${toneClass}`}
      >
        {value}
      </span>
    </div>
  );
}
