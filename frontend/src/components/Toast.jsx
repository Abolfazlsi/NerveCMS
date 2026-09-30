import {createContext, useCallback, useContext, useState} from "react";
import {CheckCircle2, AlertTriangle, Info, X, XCircle} from "lucide-react";
import clsx from "clsx";

const ToastContext = createContext(null);

const TONES = {
    success: {icon: CheckCircle2, ring: "border-good-500", iconColor: "text-good-600", bar: "bg-good-500"},
    error: {icon: XCircle, ring: "border-bad-500", iconColor: "text-bad-600", bar: "bg-bad-500"},
    warn: {icon: AlertTriangle, ring: "border-warn-500", iconColor: "text-warn-600", bar: "bg-warn-500"},
    info: {icon: Info, ring: "border-brand-500", iconColor: "text-brand-600", bar: "bg-brand-500"},
};

export function ToastProvider({children}) {
    const [toasts, setToasts] = useState([]);

    const remove = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback(
        (message, tone = "info", timeout = 3500) => {
            const id = Math.random().toString(36).slice(2);
            setToasts((prev) => [...prev, {id, message, tone}]);
            if (timeout) setTimeout(() => remove(id), timeout);
            return id;
        },
        [remove]
    );

    const toast = {
        success: (m, t) => push(m, "success", t),
        error: (m, t) => push(m, "error", t ?? 5000),
        warn: (m, t) => push(m, "warn", t),
        info: (m, t) => push(m, "info", t),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2 w-[22rem] max-w-[calc(100vw-2rem)]">
                {toasts.map((t) => {
                    const cfg = TONES[t.tone] || TONES.info;
                    const Icon = cfg.icon;
                    return (
                        <div
                            key={t.id}
                            className={clsx(
                                "relative flex items-start gap-3 bg-white rounded-xl border-l-4 shadow-lg pl-3 pr-9 py-3 overflow-hidden animate-[fadeIn_.15s_ease-out]"
                            )}
                            style={{borderColor: "var(--color-ink-100)"}}
                        >
                            <span className={clsx("absolute top-0 bottom-0 left-0 w-1.5", cfg.bar)}/>
                            <Icon className={clsx("w-5 h-5 shrink-0 mt-0.5", cfg.iconColor)}/>
                            <p className="text-sm text-ink-900 leading-relaxed whitespace-pre-line">{t.message}</p>
                            <button
                                onClick={() => remove(t.id)}
                                className="absolute top-2 left-2 w-6 h-6 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
                                aria-label="بستن"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast باید درون ToastProvider استفاده شود.");
    return ctx;
}

/** Helper: extract a readable error message from a DRF/axios error. */
export function errMsg(err, fallback = "خطایی رخ داد. لطفاً دوباره تلاش کنید.") {
    const data = err?.response?.data;
    if (!data) return err?.message || fallback;
    if (typeof data === "string") return data;
    if (data.detail) return String(data.detail);
    // DRF validation: { field: ["msg"] } or { field: "msg" }
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
    return fallback;
}
