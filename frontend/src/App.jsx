import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import {EmptyState} from "./components/ui";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import InventoryPage from "./pages/InventoryPage";
import OrdersPage from "./pages/OrdersPage";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
// Inventory procurement
import SuppliersPage from "./pages/SuppliersPage";
import WarehousesPage from "./pages/WarehousesPage";
import WarehouseStocksPage from "./pages/WarehouseStocksPage";
import StockMovementsPage from "./pages/StockMovementsPage";
import PurchasesPage from "./pages/PurchasesPage";
import StockTransfersPage from "./pages/StockTransfersPage";
import PurchaseReturnsPage from "./pages/PurchaseReturnsPage";
// Finance & sales
import SalesReturnsPage from "./pages/SalesReturnsPage";
import InvoicesPage from "./pages/InvoicesPage";
import PaymentsPage from "./pages/PaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReportsPage from "./pages/ReportsPage";
import {ToastProvider} from "./components/Toast";

function NotFound() {
    return (
        <div className="flex items-center justify-center py-24">
            <EmptyState title="صفحه‌ای یافت نشد" description="آدرس مورد نظر در دسترس نیست یا منتقل شده است."/>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage/>}/>
                        <Route element={<ProtectedRoute/>}>
                            <Route element={<AppLayout/>}>
                                <Route path="/" element={<DashboardPage/>}/>
                                <Route path="/customers" element={<CustomersPage/>}/>
                                <Route path="/inventory" element={<InventoryPage/>}/>
                                <Route path="/suppliers" element={<SuppliersPage/>}/>
                                <Route path="/warehouses" element={<WarehousesPage/>}/>
                                <Route path="/warehouse-stocks" element={<WarehouseStocksPage/>}/>
                                <Route path="/stock-movements" element={<StockMovementsPage/>}/>
                                <Route path="/purchases" element={<PurchasesPage/>}/>
                                <Route path="/stock-transfers" element={<StockTransfersPage/>}/>
                                <Route path="/purchase-returns" element={<PurchaseReturnsPage/>}/>
                                <Route path="/orders" element={<OrdersPage/>}/>
                                <Route path="/sales-returns" element={<SalesReturnsPage/>}/>
                                <Route path="/invoices" element={<InvoicesPage/>}/>
                                <Route path="/payments" element={<PaymentsPage/>}/>
                                <Route path="/expenses" element={<ExpensesPage/>}/>
                                <Route path="/reports" element={<ReportsPage/>}/>
                                <Route path="/tasks" element={<TasksPage/>}/>
                                <Route path="/settings" element={<SettingsPage/>}/>
                                <Route path="*" element={<NotFound/>}/>
                            </Route>
                        </Route>
                        <Route path="*" element={<Navigate to="/login" replace/>}/>
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
