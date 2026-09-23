import clsx from "clsx";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx("bg-white rounded-2xl border border-ink-100 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Button({ variant = "primary", size = "md", className, children, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };
  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20",
    secondary: "bg-ink-100 text-ink-900 hover:bg-ink-300/60",
    ghost: "text-ink-700 hover:bg-ink-100",
    danger: "bg-bad-500 text-white hover:bg-bad-600",
    outline: "border border-ink-300 text-ink-700 hover:bg-ink-100",
  };
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

const badgeTones = {
  brand: "bg-brand-100 text-brand-600",
  accent: "bg-accent-100 text-accent-600",
  good: "bg-good-100 text-good-600",
  warn: "bg-warn-100 text-warn-600",
  bad: "bg-bad-100 text-bad-600",
  neutral: "bg-ink-100 text-ink-700",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input({ label, error, className, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-ink-700 mb-1.5">{label}</span>}
      <input
        className={clsx(
          "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900",
          "placeholder:text-ink-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition",
          error && "border-bad-500",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-bad-600 mt-1 block">{error}</span>}
    </label>
  );
}

export function Select({ label, className, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-ink-700 mb-1.5">{label}</span>}
      <select
        className={clsx(
          "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function TextArea({ label, className, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-ink-700 mb-1.5">{label}</span>}
      <textarea
        className={clsx(
          "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900",
          "placeholder:text-ink-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-ink-500" />
        </div>
      )}
      <h3 className="font-display font-semibold text-ink-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative bg-white rounded-2xl shadow-xl w-full my-8", width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <h2 className="font-display font-semibold text-lg text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display font-semibold text-2xl text-ink-900">{title}</h1>
        {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <div
      className={clsx(
        "w-5 h-5 border-2 border-ink-300 border-t-brand-500 rounded-full animate-spin",
        className
      )}
    />
  );
}
