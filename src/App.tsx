import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useLanguage } from "./i18n";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function PageLoader() {
  return <main className="wrap" role="status" aria-live="polite"><p className="center">جارٍ تحميل الصفحة…</p></main>;
}

export default function App() {
  const { profile, loading, logout } = useAuth();
  const { pathname } = useLocation();
  const { language, toggleLanguage } = useLanguage();
  if (loading) return <PageLoader />;
  return (<>
    <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{language === "ar" ? "English" : "العربية"} <span aria-hidden="true">🌐</span></button>
    {pathname !== "/dashboard" && <header className="bar">
      <Link to="/" className="brand">🌟 {language === "ar" ? "منصة المستقبل" : "Future Platform"}</Link>
      <nav>{profile
        ? (<><Link to="/dashboard">{language === "ar" ? "لوحتي" : "Dashboard"}</Link><button onClick={() => void logout()}>{language === "ar" ? "تسجيل الخروج" : "Log out"}</button></>)
        : <Link to="/login" className="btn">{language === "ar" ? "تسجيل الدخول" : "Log in"}</Link>}</nav>
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
