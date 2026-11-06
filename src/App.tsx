import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function PageLoader() {
  return <main className="wrap" role="status" aria-live="polite"><p className="center">جارٍ تحميل الصفحة…</p></main>;
}

export default function App() {
  const { profile, loading, logout } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <PageLoader />;
  return (<>
    {pathname !== "/dashboard" && <header className="bar">
      <Link to="/" className="brand">🌟 منصة المستقبل</Link>
      <nav>{profile
        ? (<><Link to="/dashboard">لوحتي</Link><button onClick={() => void logout()}>تسجيل الخروج</button></>)
        : <Link to="/login" className="btn">تسجيل الدخول</Link>}</nav>
    </header>}
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={profile ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={profile ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </>);
}
