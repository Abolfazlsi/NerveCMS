import api from "./client";

export const authApi = {
    login: (username, password) => api.post("/auth/login/", {username, password}),
    me: () => api.get("/auth/me/"),
    updateMe: (payload) => api.patch("/auth/me/", payload),
    team: () => api.get("/auth/team/"),
    inviteTeamMember: (payload) => api.post("/auth/team/", payload),
    updateTeamMember: (id, payload) => api.patch(`/auth/team/${id}/`, payload),
    removeTeamMember: (id) => api.delete(`/auth/team/${id}/`),
};

export const customersApi = {
    list: (params) => api.get("/customers/", {params}),
    get: (id) => api.get(`/customers/${id}/`),
    create: (payload) => api.post("/customers/", payload),
    update: (id, payload) => api.patch(`/customers/${id}/`, payload),
    remove: (id) => api.delete(`/customers/${id}/`),
    listNotes: (params) => api.get("/customer-notes/", {params}),
    addNote: (customerId, body) => api.post("/customer-notes/", {customer: customerId, body}),
    updateNote: (id, body) => api.patch(`/customer-notes/${id}/`, {body}),
    removeNote: (id) => api.delete(`/customer-notes/${id}/`),
    importCsv: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/customers/import/", formData, {
            headers: {"Content-Type": "multipart/form-data"},
        });
    },
};

export const inventoryApi = {
    // Products
    listProducts: (params) => api.get("/products/", {params}),
    getProduct: (id) => api.get(`/products/${id}/`),
    createProduct: (payload) => api.post("/products/", payload),
    updateProduct: (id, payload) => api.patch(`/products/${id}/`, payload),
    removeProduct: (id) => api.delete(`/products/${id}/`),
    // Categories
    listCategories: () => api.get("/categories/"),
    createCategory: (payload) => api.post("/categories/", payload),
    updateCategory: (id, payload) => api.patch(`/categories/${id}/`, payload),
    removeCategory: (id) => api.delete(`/categories/${id}/`),
    // Stock movements
    listMovements: (params) => api.get("/stock-movements/", {params}),
    createMovement: (payload) => api.post("/stock-movements/", payload),
    adjustStock: (payload) => api.post("/stock-movements/adjust/", payload),
    // Suppliers
    listSuppliers: (params) => api.get("/suppliers/", {params}),
    getSupplier: (id) => api.get(`/suppliers/${id}/`),
    createSupplier: (payload) => api.post("/suppliers/", payload),
    updateSupplier: (id, payload) => api.patch(`/suppliers/${id}/`, payload),
    removeSupplier: (id) => api.delete(`/suppliers/${id}/`),
    // Warehouses
    listWarehouses: (params) => api.get("/warehouses/", {params}),
    getWarehouse: (id) => api.get(`/warehouses/${id}/`),
    createWarehouse: (payload) => api.post("/warehouses/", payload),
    updateWarehouse: (id, payload) => api.patch(`/warehouses/${id}/`, payload),
    removeWarehouse: (id) => api.delete(`/warehouses/${id}/`),
    // Warehouse stocks (per-product stock at each warehouse)
    listWarehouseStocks: (params) => api.get("/warehouse-stocks/", {params}),
    getWarehouseStock: (id) => api.get(`/warehouse-stocks/${id}/`),
    updateWarehouseStock: (id, payload) => api.patch(`/warehouse-stocks/${id}/`, payload),
    // Purchases
    listPurchases: (params) => api.get("/purchases/", {params}),
    getPurchase: (id) => api.get(`/purchases/${id}/`),
    createPurchase: (payload) => api.post("/purchases/", payload),
    updatePurchase: (id, payload) => api.patch(`/purchases/${id}/`, payload),
    removePurchase: (id) => api.delete(`/purchases/${id}/`),
    receivePurchase: (id) => api.post(`/purchases/${id}/receive/`),
    // Stock transfers
    listStockTransfers: (params) => api.get("/stock-transfers/", {params}),
    getStockTransfer: (id) => api.get(`/stock-transfers/${id}/`),
    createStockTransfer: (payload) => api.post("/stock-transfers/", payload),
    updateStockTransfer: (id, payload) => api.patch(`/stock-transfers/${id}/`, payload),
    removeStockTransfer: (id) => api.delete(`/stock-transfers/${id}/`),
    completeStockTransfer: (id) => api.post(`/stock-transfers/${id}/complete/`),
    // Purchase returns
    listPurchaseReturns: (params) => api.get("/purchase-returns/", {params}),
    getPurchaseReturn: (id) => api.get(`/purchase-returns/${id}/`),
    createPurchaseReturn: (payload) => api.post("/purchase-returns/", payload),
    updatePurchaseReturn: (id, payload) => api.patch(`/purchase-returns/${id}/`, payload),
    removePurchaseReturn: (id) => api.delete(`/purchase-returns/${id}/`),
    completePurchaseReturn: (id) => api.post(`/purchase-returns/${id}/complete/`),
    // CSV import (products)
    importCsv: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/products/import/", formData, {
            headers: {"Content-Type": "multipart/form-data"},
        });
    },
};

export const salesApi = {
    list: (params) => api.get("/orders/", {params}),
    get: (id) => api.get(`/orders/${id}/`),
    create: (payload) => api.post("/orders/", payload),
    update: (id, payload) => api.patch(`/orders/${id}/`, payload),
    remove: (id) => api.delete(`/orders/${id}/`),
    // Status workflow actions
    confirmOrder: (id) => api.post(`/orders/${id}/confirm/`),
    payOrder: (id) => api.post(`/orders/${id}/pay/`),
    fulfillOrder: (id) => api.post(`/orders/${id}/fulfill/`),
    // Sales returns
    listReturns: (params) => api.get("/returns/", {params}),
    getReturn: (id) => api.get(`/returns/${id}/`),
    createReturn: (payload) => api.post("/returns/", payload),
    updateReturn: (id, payload) => api.patch(`/returns/${id}/`, payload),
    removeReturn: (id) => api.delete(`/returns/${id}/`),
    completeReturn: (id) => api.post(`/returns/${id}/complete/`),
};

export const financeApi = {
    // Invoices (create from order)
    listInvoices: (params) => api.get("/invoices/", {params}),
    getInvoice: (id) => api.get(`/invoices/${id}/`),
    createInvoiceFromOrder: (orderId) => api.post("/invoices/", {order: orderId}),
    updateInvoice: (id, payload) => api.patch(`/invoices/${id}/`, payload),
    removeInvoice: (id) => api.delete(`/invoices/${id}/`),
    issueInvoice: (id) => api.post(`/invoices/${id}/issue/`),
    cancelInvoice: (id) => api.post(`/invoices/${id}/cancel/`),
    // Payments
    listPayments: (params) => api.get("/payments/", {params}),
    getPayment: (id) => api.get(`/payments/${id}/`),
    createPayment: (payload) => api.post("/payments/", payload),
    // Expenses
    listExpenses: (params) => api.get("/expenses/", {params}),
    getExpense: (id) => api.get(`/expenses/${id}/`),
    createExpense: (payload) => api.post("/expenses/", payload),
    updateExpense: (id, payload) => api.patch(`/expenses/${id}/`, payload),
    removeExpense: (id) => api.delete(`/expenses/${id}/`),
    // Reports
    reportSummary: () => api.get("/reports/summary/"),
    reportFinancial: (params) => api.get("/reports/financial/", {params}),
    reportDaily: (params) => api.get("/reports/daily/", {params}),
    reportMonthly: (params) => api.get("/reports/monthly/", {params}),
};

export const tasksApi = {
    list: (params) => api.get("/tasks/", {params}),
    get: (id) => api.get(`/tasks/${id}/`),
    create: (payload) => api.post("/tasks/", payload),
    update: (id, payload) => api.patch(`/tasks/${id}/`, payload),
    remove: (id) => api.delete(`/tasks/${id}/`),
};

export const dashboardApi = {
    summary: () => api.get("/dashboard/summary/"),
};
