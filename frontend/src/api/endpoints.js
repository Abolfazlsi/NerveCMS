import api from "./client";

export const authApi = {
  login: (username, password) => api.post("/auth/login/", { username, password }),
  me: () => api.get("/auth/me/"),
  updateMe: (payload) => api.patch("/auth/me/", payload),
  team: () => api.get("/auth/team/"),
  inviteTeamMember: (payload) => api.post("/auth/team/", payload),
  removeTeamMember: (id) => api.delete(`/auth/team/${id}/`),
};

export const customersApi = {
  list: (params) => api.get("/customers/", { params }),
  get: (id) => api.get(`/customers/${id}/`),
  create: (payload) => api.post("/customers/", payload),
  update: (id, payload) => api.patch(`/customers/${id}/`, payload),
  remove: (id) => api.delete(`/customers/${id}/`),
  addNote: (customerId, body) => api.post("/customer-notes/", { customer: customerId, body }),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/customers/import/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const inventoryApi = {
  listProducts: (params) => api.get("/products/", { params }),
  getProduct: (id) => api.get(`/products/${id}/`),
  createProduct: (payload) => api.post("/products/", payload),
  updateProduct: (id, payload) => api.patch(`/products/${id}/`, payload),
  removeProduct: (id) => api.delete(`/products/${id}/`),
  listCategories: () => api.get("/categories/"),
  createCategory: (payload) => api.post("/categories/", payload),
  listMovements: (params) => api.get("/stock-movements/", { params }),
  createMovement: (payload) => api.post("/stock-movements/", payload),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/products/import/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const salesApi = {
  list: (params) => api.get("/orders/", { params }),
  get: (id) => api.get(`/orders/${id}/`),
  create: (payload) => api.post("/orders/", payload),
  update: (id, payload) => api.patch(`/orders/${id}/`, payload),
  remove: (id) => api.delete(`/orders/${id}/`),
};

export const tasksApi = {
  list: (params) => api.get("/tasks/", { params }),
  create: (payload) => api.post("/tasks/", payload),
  update: (id, payload) => api.patch(`/tasks/${id}/`, payload),
  remove: (id) => api.delete(`/tasks/${id}/`),
};

export const dashboardApi = {
  summary: () => api.get("/dashboard/summary/"),
};
