import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useLanguage } from "./i18n";
import { useSite } from "./pages/HomeExtras";

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
  const { heroBanner } = useSite();
  if (loading) return <PageLoader />;
  return (<>
    {pathname !== "/dashboard" && <header className="bar">
      <Link to="/" className="brand brand-with-photo" aria-label={language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"} style={heroBanner.imageData ? {backgroundImage:`linear-gradient(rgba(9,30,55,${1-heroBanner.opacity}),rgba(9,30,55,${1-heroBanner.opacity})),url("${heroBanner.imageData}")`,backgroundPosition:heroBanner.position,backgroundSize:"cover"} : undefined}><span className="brand-mark" aria-hidden="true">✦</span><span className="brand-title">{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</span></Link>
      <nav className="bar-actions">
        <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{language === "ar" ? "English" : "العربية"} 🌐</button>
        {profile
          ? <><Link to="/dashboard">{language === "ar" ? "لوحتي" : "Dashboard"}</Link><button className="auth-action" onClick={() => void logout()}>{language === "ar" ? "تسجيل الخروج" : "Log out"}</button></>
          : <Link to="/login" className="btn">{language === "ar" ? "تسجيل الدخول" : "Log in"}</Link>}
      </nav>
    </header>}
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={profile ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={profile ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>

    <aside aria-label="التواصل عبر واتساب" style={{ position: "fixed", left: 16, bottom: 18, zIndex: 1000, display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        { number: "201066585168", label: "واتساب 1" },
        { number: "201018203724", label: "واتساب 2" },
      ].map((contact) => (
        <a
          key={contact.number}
          href={`https://wa.me/${contact.number}?text=${encodeURIComponent("مرحبًا، لدي استفسار بخصوص منصة المستقبل التعليمية")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`التواصل عبر ${contact.label}`}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 999, background: "#25D366", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px rgba(0,0,0,.22)", direction: "rtl" }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M20.52 3.48A11.8 11.8 0 0 0 12.1 0C5.56 0 .24 5.32.24 11.86c0 2.09.55 4.13 1.6 5.93L.14 24l6.37-1.67a11.9 11.9 0 0 0 5.58 1.42h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.15-3.44-8.41ZM12.1 21.73a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.78.99 1.01-3.68-.23-.38a9.82 9.82 0 0 1-1.51-5.21c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.81.38-.28.3-1.06 1.03-1.06 2.52s1.09 2.92 1.24 3.12c.15.2 2.14 3.27 5.18 4.58.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
          </svg>
          {contact.label}
        </a>
      ))}
    </aside>
  </>);
}
