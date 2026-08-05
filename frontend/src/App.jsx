import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Companies from "./pages/Companies";
import Directors from "./pages/Directors";
import Blacklist from "./pages/Blacklist";
import Login from "./pages/Login";
import { ENABLE_AUTH } from "./utils/constants";
import { getStoredUser } from "./utils/auth";

function ProtectedRoute({ children }) {
  const location = useLocation();
  if (ENABLE_AUTH && !getStoredUser()) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      {ENABLE_AUTH && <Route path="/login" element={<Login />} />}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/directors" element={<Directors />} />
        <Route path="/blacklist" element={<Blacklist />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}