import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal, Button } from "./ui";

/**
 * A generic "upload a CSV to bulk-import records" modal. Pass an
 * `onImport(file)` function that calls the right API endpoint
 * (customersApi.importCsv or inventoryApi.importCsv), plus a short
 * `columnsHint` describing which columns the backend recognises for
 * this particular import — this is the main thing to customize per
 * client if their CSV has different columns than the template default.
 */
export default function ImportCsvModal({ open, onClose, title, columnsHint, onImport, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { data } = await onImport(file);
      setResult(data);
      onDone?.();
    } catch (err) {
      setError(
        err.response?.data?.detail || "خطا در بارگذاری فایل"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} width="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-ink-500">{columnsHint}</p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-300 rounded-xl py-8 px-4 cursor-pointer hover:border-brand-500 hover:bg-brand-100/30 transition-colors">
          <UploadCloud className="w-6 h-6 text-ink-500" />
          <span className="text-sm text-ink-700 font-medium">
            {file ? file.name : "Click to choose a CSV file"}
          </span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setError("");
            }}
          />
        </label>

        {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}

        {result && (
          <div className="rounded-xl border border-ink-100 p-4 space-y-2">
            <div className="flex items-center gap-2 text-good-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">
                {result.created} created, {result.updated} updated
              </span>
            </div>
            {result.errors?.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-warn-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{result.errors.length} row(s) skipped</span>
                </div>
                <ul className="text-xs text-ink-500 max-h-32 overflow-y-auto pl-6 list-disc">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button type="button" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Importing…" : "Import"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
