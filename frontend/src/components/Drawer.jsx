import clsx from "clsx";

/**
 * A right-side slide-in drawer for detail views.
 * Use `width` to control size (default max-w-xl).
 */
export default function Drawer({ open, onClose, title, children, footer, width = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          "relative bg-white shadow-2xl w-full mr-auto h-full flex flex-col animate-[slideIn_.2s_ease-out]",
          width
        )}
        style={{ animationName: "drawerSlideIn" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 shrink-0">
          <h2 className="font-display font-semibold text-lg text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-100 shrink-0">{footer}</div>}
      </div>
      <style>{`@keyframes drawerSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </div>
  );
}
