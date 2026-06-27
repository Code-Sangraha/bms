import { Navigate, Route, Routes } from "react-router-dom";
import LayoutWrapper from "./components/LayoutWrapper";
import InstallPrompt from "./components/InstallPrompt/InstallPrompt";
import { I18nProvider } from "./providers/I18nProvider";
import QueryProvider from "./providers/QueryProvider";
import LoginPage from "./(auth)/login/page";
import RegisterPage from "./(auth)/register/page";
import DashboardPage from "./dashboard/page";
import OutletPage from "./dashboard/outlet/page";
import UsersPage from "./dashboard/users/page";
import DualPricingPage from "./dashboard/dualPricing/page";
import DepartmentsPage from "./dashboard/departments/page";
import ProcessingPlantPage from "./dashboard/processingPlant/page";
import ProductTypePage from "./dashboard/product/productType/page";
import ProductPage from "./dashboard/product/page";
import LiveProductPage from "./dashboard/product/liveProduct/page";
import LivestockItemDetailPage from "./dashboard/product/liveProduct/LivestockItemDetailPage";
import ProcessedProductPage from "./dashboard/product/processedProduct/page";
import ProcessedProductDetailPage from "./dashboard/product/processedProduct/ProcessedProductDetailPage";
import WasteProductPage from "./dashboard/product/wasteProduct/page";
import LivestockCategoryPage from "./dashboard/product/livestockCategoryV2/page";
import InvoicesPage from "./dashboard/invoices/page";
import InvoicesNewPage from "./dashboard/invoices/new/page";
import WasteSalesPage from "./dashboard/invoices/waste-sales/page";
import LivestockSalesPage from "./dashboard/invoices/livestocksales/page";
import OutletExpensesPage from "./dashboard/outlets/expenses/page";
import TransactionPage from "./dashboard/invoices/transaction/page";
import CustomerTypesPage from "./dashboard/invoices/customer-types/page";
import CustomersPage from "./dashboard/invoices/customers/page";
import LoyaltyRulesPage from "./dashboard/invoices/loyalty-rules/page";
import AnalyticsPage from "./dashboard/analytics/page";
import RolesPage from "./dashboard/accounts/roles/page";
import RolesCreatePage from "./dashboard/accounts/roles/create/page";
import DirectoryPage from "./dashboard/accounts/directory/page";
import ClockInOutPage from "./dashboard/accounts/clock-in-out/page";
import AccountsAnalyticsPage from "./dashboard/accounts/analytics/page";
import MorePage from "./dashboard/more/page";

export default function App() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <QueryProvider>
        <I18nProvider>
          <InstallPrompt />
          <Routes>
            <Route path="/" element={<LayoutWrapper />}>
              <Route index element={<Navigate to="/login" replace />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="dashboard/outlet" element={<OutletPage />} />
              <Route path="dashboard/outlets/expenses" element={<OutletExpensesPage />} />
              <Route path="dashboard/users" element={<UsersPage />} />
              <Route path="dashboard/dualPricing" element={<DualPricingPage />} />
              <Route path="dashboard/departments" element={<DepartmentsPage />} />
              <Route path="dashboard/processingPlant" element={<ProcessingPlantPage />} />
              <Route path="dashboard/product" element={<ProductPage />} />
              <Route path="dashboard/product/productType" element={<ProductTypePage />} />
              <Route path="dashboard/product/livestockCategory" element={<LivestockCategoryPage />} />
              <Route
                path="dashboard/product/liveProduct/:productId/item/:itemId"
                element={<LivestockItemDetailPage />}
              />
              <Route path="dashboard/product/liveProduct" element={<LiveProductPage />} />
              <Route
                path="dashboard/product/processedProduct/:productId"
                element={<ProcessedProductDetailPage />}
              />
              <Route path="dashboard/product/processedProduct" element={<ProcessedProductPage />} />
              <Route path="dashboard/product/wasteProduct" element={<WasteProductPage />} />
              <Route path="dashboard/invoices" element={<InvoicesPage />} />
              <Route path="dashboard/invoices/new" element={<InvoicesNewPage />} />
              <Route path="dashboard/invoices/waste-sales" element={<WasteSalesPage />} />
              <Route path="dashboard/invoices/livestock-sales" element={<LivestockSalesPage />} />
              <Route path="dashboard/invoices/transaction" element={<TransactionPage />} />
              <Route path="dashboard/invoices/customer-types" element={<CustomerTypesPage />} />
              <Route path="dashboard/invoices/customers" element={<CustomersPage />} />
              <Route path="dashboard/invoices/loyalty-rules" element={<LoyaltyRulesPage />} />
              <Route path="dashboard/analytics" element={<AnalyticsPage />} />
              <Route path="dashboard/accounts/roles" element={<RolesPage />} />
              <Route path="dashboard/accounts/roles/create" element={<RolesCreatePage />} />
              <Route path="dashboard/accounts/directory" element={<DirectoryPage />} />
              <Route path="dashboard/accounts/clock-in-out" element={<ClockInOutPage />} />
              <Route path="dashboard/accounts/analytics" element={<AccountsAnalyticsPage />} />
              <Route path="dashboard/more" element={<MorePage />} />
            </Route>
          </Routes>
        </I18nProvider>
      </QueryProvider>
    </div>
  );
}

