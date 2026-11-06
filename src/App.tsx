import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const { profile, loading, logout } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p className="center">جارٍ التحميل…</p>;
  return (<>
    {pathname !== "/dashboard" && <header className="bar">
      <Link to="/" className="brand">🌟 منصة المستقبل</Link>
      <nav>{profile
        ? (<><Link to="/dashboard">لوحتي</Link><button onClick={logout}>تسجيل الخروج</button></>)
        : <Link to="/login" className="btn">تسجيل الدخول</Link>}</nav>
    </header>}
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={profile ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={profile ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </>);
}
