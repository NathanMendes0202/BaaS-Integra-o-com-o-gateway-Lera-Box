import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import CheckoutPage from './pages/CheckoutPage';
import DashboardPage from './pages/DashboardPage';
import GatewayPage from './pages/GatewayPage';
import LinksPage from './pages/LinksPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import ReceiptPage from './pages/ReceiptPage';
import TransactionsPage from './pages/TransactionsPage';
import WalletPage from './pages/WalletPage';
import WebhooksPage from './pages/WebhooksPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Carregando...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/pagar/:code" element={<CheckoutPage />} />
      <Route path="/comprovante/:code" element={<ReceiptPage />} />

      {/* Área do lojista */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/transacoes" element={<TransactionsPage />} />
        <Route path="/carteira" element={<WalletPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="/gateway" element={<GatewayPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
