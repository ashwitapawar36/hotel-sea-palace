import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { MenuProvider } from "./context/MenuContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { ManagerProvider } from "./context/ManagerContext";
import FloatingCart from "./components/FloatingCart";
import RequireTable from "./components/RequireTable";

import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Cart from "./pages/Cart";
import SplitBill from "./pages/SplitBill";
import DigitalBill from "./pages/DigitalBill";
import OrderSuccess from "./pages/OrderSuccess";
import Feedback from "./pages/Feedback";

import ManagerLogin from "./pages/manager/ManagerLogin";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import OrderManagement from "./pages/manager/OrderManagement";
import MenuManagement from "./pages/manager/MenuManagement";
import SpecialsManagement from "./pages/manager/SpecialsManagement";
import StockManagement from "./pages/manager/StockManagement";
import QRManagement from "./pages/manager/QRManagement";
import RequireManager from "./components/RequireManager";

function ManagerLayout() {
  return (
    <ToastProvider>
      <ManagerProvider>
        <Outlet />
      </ManagerProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <MenuProvider>
      <CartProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={<RequireTable><Home /></RequireTable>}
              />
              <Route
                path="/menu"
                element={<RequireTable><Menu /></RequireTable>}
              />
              <Route
                path="/cart"
                element={<RequireTable><Cart /></RequireTable>}
              />
              <Route
                path="/split-bill"
                element={<RequireTable><SplitBill /></RequireTable>}
              />
              <Route
                path="/bill"
                element={<RequireTable><DigitalBill /></RequireTable>}
              />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/feedback" element={<Feedback />} />

              <Route path="/manager" element={<ManagerLayout />}>
                <Route path="login" element={<ManagerLogin />} />
                <Route
                  path="dashboard"
                  element={<RequireManager><ManagerDashboard /></RequireManager>}
                />
                <Route
                  path="orders"
                  element={<RequireManager><OrderManagement /></RequireManager>}
                />
                <Route
                  path="menu"
                  element={<RequireManager><MenuManagement /></RequireManager>}
                />
                <Route
                  path="specials"
                  element={<RequireManager><SpecialsManagement /></RequireManager>}
                />
                <Route
                  path="stock"
                  element={<RequireManager><StockManagement /></RequireManager>}
                />
                <Route
                  path="qr"
                  element={<RequireManager><QRManagement /></RequireManager>}
                />
              </Route>
            </Routes>

            <FloatingCart />
          </BrowserRouter>
        </ToastProvider>
      </CartProvider>
    </MenuProvider>
  );
}