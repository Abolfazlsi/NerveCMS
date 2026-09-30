// Shared status label & tone maps used across pages.
// Centralised so every page shows consistent Persian labels and colors.

export const ORDER_STATUS = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  pending: { label: "در انتظار پرداخت", tone: "warn" },
  paid: { label: "پرداخت‌شده", tone: "good" },
  fulfilled: { label: "تکمیل‌شده", tone: "brand" },
  cancelled: { label: "لغوشده", tone: "bad" },
};

export const INVOICE_STATUS = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  issued: { label: "صادرشده", tone: "warn" },
  paid: { label: "پرداخت‌شده", tone: "good" },
  cancelled: { label: "باطل‌شده", tone: "bad" },
};

export const PAYMENT_STATUS = {
  UNPAID: { label: "پرداخت‌نشده", tone: "bad" },
  PARTIALLY_PAID: { label: "بخشی پرداخت‌شده", tone: "warn" },
  PAID: { label: "تسویه‌شده", tone: "good" },
};

export const CUSTOMER_STATUS = {
  lead: { label: "در انتظار", tone: "accent" },
  active: { label: "فعال", tone: "good" },
  inactive: { label: "غیرفعال", tone: "neutral" },
};

export const CUSTOMER_SOURCE = {
  referral: "معرفی",
  website: "وب‌سایت",
  social: "شبکه‌های اجتماعی",
  cold_outreach: "تماس سرد",
  event: "رویداد",
  other: "سایر",
};

export const PURCHASE_STATUS = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  ordered: { label: "سفارش‌داده‌شده", tone: "warn" },
  received: { label: "تحویل‌گرفته‌شده", tone: "good" },
  cancelled: { label: "لغوشده", tone: "bad" },
};

export const MOVEMENT_TYPE = {
  in: { label: "ورود", tone: "good" },
  out: { label: "خروج", tone: "bad" },
  adjustment: { label: "تنظیم", tone: "warn" },
};

export const TRANSFER_STATUS = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  completed: { label: "تکمیل‌شده", tone: "good" },
  cancelled: { label: "لغوشده", tone: "bad" },
};

export const RETURN_STATUS = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  completed: { label: "تکمیل‌شده", tone: "good" },
  cancelled: { label: "لغوشده", tone: "bad" },
};

export const TASK_STATUS = {
  todo: { label: "برای انجام", tone: "neutral" },
  in_progress: { label: "در حال انجام", tone: "warn" },
  done: { label: "انجام‌شده", tone: "good" },
};

export const TASK_PRIORITY = {
  low: { label: "کم", tone: "neutral" },
  medium: { label: "متوسط", tone: "warn" },
  high: { label: "بالا", tone: "bad" },
};

export const ROLE = {
  owner: { label: "مالک", tone: "brand" },
  admin: { label: "مدیر سیستم", tone: "good" },
  manager: { label: "مدیر", tone: "warn" },
  staff: { label: "کارمند", tone: "neutral" },
};

export const PAYMENT_METHOD = {
  cash: "نقدی",
  card: "کارت",
  bank_transfer: "انتقال بانکی",
  online: "آنلاین",
  other: "سایر",
};

// Role helpers
export const isAdmin = (role) => role === "owner" || role === "admin";
export const canDelete = (role) => role === "owner" || role === "admin";
export const canWrite = (role) => ["owner", "admin", "manager"].includes(role);
