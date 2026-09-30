import { AlertTriangle } from "lucide-react";
import { Modal, Button } from "./ui";

/**
 * A styled confirmation dialog (replaces native confirm()).
 * `confirmText`, `cancelText`, `tone` ("danger" | "primary"), `loading`.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "تایید عملیات",
  message,
  confirmText = "تایید",
  cancelText = "انصراف",
  tone = "danger",
  loading = false,
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <div className="flex items-start gap-4">
        <div
          className={
            tone === "danger"
              ? "w-11 h-11 rounded-2xl bg-bad-100 text-bad-600 flex items-center justify-center shrink-0"
              : "w-11 h-11 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0"
          }
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-ink-700 leading-relaxed pt-1">{message}</p>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "در حال انجام…" : confirmText}
        </Button>
      </div>
    </Modal>
  );
}
