import { Navigate, Route, Routes } from "react-router-dom";
import LayoutWrapper from "./components/LayoutWrapper";
import InstallPrompt from "./components/InstallPrompt/InstallPrompt";
import { I18nProvider } from "./providers/I18nProvider";
import QueryProvider from "./providers/QueryProvider";
import LoginPage from "./(auth)/login/page";
import RegisterPage from "./(auth)/register/page";
import DashboardPage from "./dashboard/page";
import OutletPage from "./dashboard/settings/outlet/page";
import UsersPage from "./dashboard/settings/users/page";
import DualPricingPage from "./dashboard/settings/dualPricing/page";
import DepartmentsPage from "./dashboard/settings/departments/page";
import ProcessingPlantPage from "./dashboard/settings/processingPlant/page";
import ProductTypePage from "./dashboard/product/productType/page";
import ProductPage from "./dashboard/product/page";
import LiveProductPage from "./dashboard/product/liveProduct/page";
import ProcessedProductPage from "./dashboard/product/processedProduct/page";
import LivestockCategoryPage from "./dashboard/product/livestockCategory/page";
import InvoicesPage from "./dashboard/invoices/page";
import InvoicesNewPage from "./dashboard/invoices/new/page";
import LivestockSalesPage from "./dashboard/invoices/livestocksales/page";
import TransactionPage from "./dashboard/invoices/transaction/page";
import CustomerTypesPage from "./dashboard/invoices/customer-types/page";
import AnalyticsPage from "./dashboard/analytics/page";
import RolesPage from "./dashboard/accounts/roles/page";
import RolesCreatePage from "./dashboard/accounts/roles/create/page";
import DirectoryPage from "./dashboard/accounts/directory/page";
import ClockInOutPage from "./dashboard/accounts/clock-in-out/page";
import AccountsAnalyticsPage from "./dashboard/accounts/analytics/page";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased">
      <QueryProvider>
        <I18nProvider>
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<LayoutWrapper />}>
            <Route index element={<Navigate to="/login" replace />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="dashboard/settings/outlet" element={<OutletPage />} />
            <Route path="dashboard/settings/users" element={<UsersPage />} />
            <Route path="dashboard/settings/dualPricing" element={<DualPricingPage />} />
            <Route path="dashboard/settings/departments" element={<DepartmentsPage />} />
            <Route path="dashboard/settings/processingPlant" element={<ProcessingPlantPage />} />
            <Route path="dashboard/product" element={<ProductPage />} />
            <Route path="dashboard/product/productType" element={<ProductTypePage />} />
            <Route path="dashboard/product/livestockCategory" element={<LivestockCategoryPage />} />
            <Route path="dashboard/product/liveProduct" element={<LiveProductPage />} />
            <Route path="dashboard/product/processedProduct" element={<ProcessedProductPage />} />
            <Route path="dashboard/invoices" element={<InvoicesPage />} />
            <Route path="dashboard/invoices/new" element={<InvoicesNewPage />} />
            <Route path="dashboard/invoices/livestock-sales" element={<LivestockSalesPage />} />
            <Route path="dashboard/invoices/transaction" element={<TransactionPage />} />
            <Route path="dashboard/invoices/customer-types" element={<CustomerTypesPage />} />
            <Route path="dashboard/analytics" element={<AnalyticsPage />} />
            <Route path="dashboard/accounts/roles" element={<RolesPage />} />
            <Route path="dashboard/accounts/roles/create" element={<RolesCreatePage />} />
            <Route path="dashboard/accounts/directory" element={<DirectoryPage />} />
            <Route path="dashboard/accounts/clock-in-out" element={<ClockInOutPage />} />
              <Route path="dashboard/accounts/analytics" element={<AccountsAnalyticsPage />} />
            </Route>
          </Routes>
        </I18nProvider>
      </QueryProvider>
    </div>
  );
}
