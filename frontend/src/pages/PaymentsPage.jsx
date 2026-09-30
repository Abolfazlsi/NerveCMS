import { useEffect, useState, useCallback } from "react";
import { Plus, CreditCard, DollarSign } from "lucide-react";
import { financeApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Select, Input, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { PAYMENT_METHOD, canWrite } from "../utils/constants";
import { formatCurrency, formatDateTime } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

// Build "YYYY-MM-DDTHH:MM" representing the user's actual local wall-clock
// time so the <input type="datetime-local"> default the user sees matches
// their clock. The backend (TIME_ZONE=Asia/Tehran, USE_TZ=True) interprets
// naive datetime submissions in Tehran time, so the value the user picks
// lines up with what the server records.
const localNowForInput = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(
  ([value, label]) => ({ value, label })
);

const emptyForm = {
  invoice: "",
  amount: "",
  payment_method: "cash",
  reference_number: "",
  paid_at: localNowForInput(),
};

export default function PaymentsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [allInvoices, setAllInvoices] = useState([]);
  // Invoices eligible for a NEW payment. The create_payment service only
  // accepts invoices in status 'issued' (or 'paid', but a fully-paid invoice
  // has zero remaining so the amount check would always fail). On top of
  // that, exclude any invoice already marked PAID — these are the only
  // invoices for which recording a new payment makes sense.
  const eligibleInvoices = allInvoices.filter(
    (inv) => inv.status === "issued" && inv.payment_status !== "PAID"
  );

  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load the full invoice list once on mount. Used both by the filter
  // dropdown (which can target any invoice, paid or not) and by the
  // create-payment modal (filtered down to eligible invoices).
  const loadInvoices = useCallback(() => {
    collectAll(financeApi.listInvoices)
      .then(setAllInvoices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const load = useCallback(() => {
    setLoading(true);
    financeApi
      .listPayments({
        invoice: invoiceFilter || undefined,
        page,
      })
      .then((res) => {
        const data = res.data;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCount(data.count ?? results.length);
        // The PaymentViewSet only supports ?invoice= + ?page; filter by
        // payment_method on the loaded page (matches StockMovementsPage's
        // client-side type filter pattern).
        setItems(
          methodFilter
            ? results.filter((p) => p.payment_method === methodFilter)
            : results
        );
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [invoiceFilter, methodFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [invoiceFilter, methodFilter]);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const selectedInvoice = form.invoice
    ? eligibleInvoices.find((i) => String(i.id) === String(form.invoice))
    : null;
  const remaining = selectedInvoice
    ? Number(selectedInvoice.remaining_amount ?? 0)
    : 0;

  const openModal = () => {
    setForm({ ...emptyForm, paid_at: localNowForInput() });
    setError("");
    setModalOpen(true);
  };

  const onInvoiceChange = (e) => {
    const id = e.target.value;
    const inv = id
      ? eligibleInvoices.find((i) => String(i.id) === String(id))
      : null;
    setForm((f) => ({
      ...f,
      invoice: id,
      // Pre-fill the amount with the invoice's remaining balance so a
      // full payment is one click away; the user can still override.
      amount: inv ? String(inv.remaining_amount ?? "") : "",
    }));
  };

  const fillRemaining = () => {
    if (selectedInvoice) {
      setForm((f) => ({ ...f, amount: String(remaining ?? "") }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoice) {
      setError("لطفاً فاکتور را انتخاب کنید.");
      return;
    }
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("مبلغ پرداخت باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    if (selectedInvoice && amountNum > remaining) {
      setError(
        `مبلغ پرداخت نمی‌تواند بیشتر از مانده فاکتور باشد. مانده: ${formatCurrency(remaining)}`
      );
      return;
    }
    if (!form.paid_at) {
      setError("تاریخ پرداخت را وارد کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        invoice: Number(form.invoice),
        amount: amountNum,
        payment_method: form.payment_method,
        paid_at: new Date(form.paid_at).toISOString(),
        reference_number: form.reference_number || "",
      };
      await financeApi.createPayment(payload);
      toast.success("پرداخت ثبت شد");
      setModalOpen(false);
      setForm({ ...emptyForm, paid_at: localNowForInput() });
      // A successful payment may have flipped the invoice to PAID — refresh
      // the invoice dropdown so it disappears from the eligible list and the
      // filter list stays current.
      loadInvoices();
      load();
    } catch (err) {
      setError(
        errMsg(
          err,
          "ثبت پرداخت ممکن نشد. مبلغ نباید از مانده بیشتر باشد و فاکتور باید صادرشده باشد."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredOut = items.length === 0 && count > 0 && !!methodFilter;

  return (
    <div>
      <PageHeader
        title="پرداخت‌ها"
        description="ثبت و پیگیری پرداخت‌های فاکتور"
        actions={
          writable ? (
            <Button onClick={openModal}>
              <Plus className="w-4 h-4" /> ثبت پرداخت
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={invoiceFilter}
          onChange={(e) => setInvoiceFilter(e.target.value)}
          className="sm:flex-1"
        >
          <option value="">همه فاکتورها</option>
          {allInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.invoice_number} — {inv.customer_name || "بدون مشتری"}
            </option>
          ))}
        </Select>
        <Select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه روش‌ها</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={
              filteredOut
                ? "در این صفحه پرداختی با این روش وجود ندارد"
                : "هنوز پرداختی ثبت نشده"
            }
            description={
              filteredOut
                ? "صفحه بعدی را بررسی کنید یا فیلتر روش را تغییر دهید."
                : "پرداخت‌های فاکتورها برای پیگیری مالی اینجا ثبت می‌شود."
            }
            action={
              writable && !filteredOut ? (
                <Button onClick={openModal}>
                  <Plus className="w-4 h-4" /> ثبت پرداخت
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">تاریخ پرداخت</th>
                  <th className="px-5 py-3 font-medium">فاکتور</th>
                  <th className="px-5 py-3 font-medium text-left">
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <DollarSign className="w-3.5 h-3.5" />
                      مبلغ
                    </span>
                  </th>
                  <th className="px-5 py-3 font-medium">روش</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">
                    شماره مرجع
                  </th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">
                    تاریخ ثبت
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-ink-700 whitespace-nowrap">
                      {formatDateTime(p.paid_at)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-ink-900 whitespace-nowrap">
                      {p.invoice_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-ink-900 text-left whitespace-nowrap">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="brand">
                        {p.payment_method_display ||
                          PAYMENT_METHOD[p.payment_method] ||
                          p.payment_method}
                      </Badge>
                    </td>
                    <td
                      className="px-5 py-3.5 hidden md:table-cell text-ink-500 max-w-xs truncate"
                      title={p.reference_number || ""}
                    >
                      {p.reference_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500 whitespace-nowrap">
                      {formatDateTime(p.created_at)}
                    </td>
                  </tr>
                ))}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="ثبت پرداخت جدید"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Select
              label="فاکتور"
              required
              value={form.invoice}
              onChange={onInvoiceChange}
            >
              <option value="">انتخاب فاکتور…</option>
              {eligibleInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  فاکتور {inv.invoice_number} —{" "}
                  {inv.customer_name || "بدون مشتری"} (مانده:{" "}
                  {formatCurrency(inv.remaining_amount)})
                </option>
              ))}
            </Select>
            {selectedInvoice && (
              <p className="text-xs text-ink-500 mt-1.5">
                مانده‌ی فاکتور:{" "}
                <span className="font-mono">{formatCurrency(remaining)}</span>
              </p>
            )}
            {eligibleInvoices.length === 0 && (
              <p className="text-xs text-ink-500 mt-1.5">
                هیچ فاکتور صادرشده‌ی پرداخت‌نشده‌ای موجود نیست.
              </p>
            )}
          </div>

          <div>
            <Input
              label="مبلغ"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={update("amount")}
            />
            {selectedInvoice && (
              <button
                type="button"
                onClick={fillRemaining}
                className="text-xs text-brand-600 hover:text-brand-700 mt-1.5"
              >
                پر کردن با مانده فاکتور
              </button>
            )}
          </div>

          <Select
            label="روش پرداخت"
            value={form.payment_method}
            onChange={update("payment_method")}
          >
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Input
            label="شماره مرجع (اختیاری)"
            value={form.reference_number}
            onChange={update("reference_number")}
            placeholder="شماره تراکنش، فیش واریز…"
          />

          <Input
            label="تاریخ پرداخت"
            type="datetime-local"
            required
            value={form.paid_at}
            onChange={update("paid_at")}
          />

          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : "ثبت پرداخت"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
