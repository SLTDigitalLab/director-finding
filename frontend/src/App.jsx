import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Companies from "./pages/Companies";
import Directors from "./pages/Directors";
import Blacklist from "./pages/Blacklist";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/directors" element={<Directors />} />
        <Route path="/blacklist" element={<Blacklist />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
