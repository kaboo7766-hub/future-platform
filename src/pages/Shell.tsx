import { ReactNode, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useLanguage } from "../i18n";
import type { Role } from "../auth/AuthContext";
import Notifications from "./Notifications";

export interface NavItem { id: string; icon: string; label: string; disabled?: boolean; badge?: string }
interface Props {
  name: string;
  role: Role;
  roleLabel: string;
  nav: NavItem[];
  adminNav?: NavItem[];
  view: string;
  onView: (id: string) => void;
  stats: [string, number][];
  onLogout: () => void;
  children?: ReactNode;
}
export default function Shell({ name, role, roleLabel, nav, adminNav = [], view, onView, stats, onLogout, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerSettings, setBannerSettings] = useState({ image: "", position: "center center", zoom: 100, x: 50, y: 50, titleColor: "#ffffff", titleSize: 54, titleFont: "Cairo, Tahoma, sans-serif" });
  useEffect(() => onSnapshot(doc(db, "themeSettings", "global"), snap => {
    const data = snap.data();
    setBannerSettings({ image: typeof data?.heroBannerImageDataV2 === "string" ? data.heroBannerImageDataV2 : "", position: typeof data?.heroPosition === "string" ? data.heroPosition : "center center", zoom: Math.min(250, Math.max(100, Number(data?.heroImageZoom ?? 100))), x: Math.min(100, Math.max(0, Number(data?.heroImageX ?? 50))), y: Math.min(100, Math.max(0, Number(data?.heroImageY ?? 50))), titleColor: typeof data?.heroTitleColor === "string" ? data.heroTitleColor : "#ffffff", titleSize: Math.min(88, Math.max(28, Number(data?.heroTitleSize ?? 54))), titleFont: typeof data?.heroTitleFont === "string" ? data.heroTitleFont : "Cairo, Tahoma, sans-serif" });
  }), []);
  const { language, toggleLanguage } = useLanguage();
  const choose = (id: string) => { onView(id); setMenuOpen(false); };
  const isAdmin = role === "admin";
  const points = stats.find(([label]) => label === "نقاطي")?.[1];
  const studentSections = isAdmin
    ? nav.filter(item => ["home", "lessons", "games", "quizzes", "learning", "quran", "live", "assignments"].includes(item.id))
    : nav;
  const renderItems = (items: NavItem[]) => items.map(item => (
    <button key={item.id} type="button" className={view === item.id ? "on" : ""} aria-current={view === item.id ? "page" : undefined}
      aria-disabled={item.disabled || undefined} disabled={item.disabled} onClick={() => choose(item.id)}>
      <span className="nav-icon">{item.icon}</span><small>{item.label}</small>
      {item.badge && <em className="nav-badge">{item.badge}</em>}
    </button>
  ));
  return <div className={`app dashboard-layout ${isAdmin ? "admin-layout" : "student-layout"}`} dir={language === "ar" ? "rtl" : "ltr"}>
    <header className="topbar">
      <div className="topbar-brand"><span className="topbar-brand-mark">✦</span><b>{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</b></div>
      <span className="who">{name} · {roleLabel}</span>
      <div className="topbar-actions">
        {typeof points === "number" && <span className="topbar-points" title="نقاطي">⭐ {points.toLocaleString("ar-EG")}</span>}
        <div className="topbar-notifications"><Notifications compact /></div>
        <button className="top-logout" onClick={onLogout}>{language === "ar" ? "تسجيل الخروج" : "Log out"}</button>
        <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{language === "ar" ? "English" : "العربية"} 🌐</button>
        <button className={`menu-toggle ${menuOpen ? "is-open" : ""}`} type="button" aria-label={language === "ar" ? "فتح القائمة" : "Open menu"} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(v => !v)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
    {isAdmin && <aside className={`side admin-side ${menuOpen ? "menu-open" : ""}`} aria-label="لوحة الإدارة">
      <div className="side-heading"><span>🛡️</span><div><b>إدارة المنصة</b><small>لوحة المالك والمدير</small></div></div>
      {renderItems(adminNav)}
      <div className="side-note">تحكم كامل في المحتوى والمستخدمين</div>
    </aside>}
    <aside id="dashboard-navigation" className={`side student-side ${menuOpen ? "menu-open" : ""}`} aria-label={language === "ar" ? "أقسام التعلّم" : "Learning navigation"}>
      <div className="side-heading"><span>🎒</span><div><b>{language === "ar" ? "رحلتي التعليمية" : "My learning"}</b><small>{language === "ar" ? "اختر وجهتك" : "Choose a section"}</small></div></div>
      {renderItems(studentSections)}
      <div className="side-note">🌟 تعلّم، العب، وتقدّم كل يوم</div>
    </aside>
    {menuOpen && <button className="menu-backdrop" aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"} onClick={() => setMenuOpen(false)} />}
    <main className="content">
      <section className="cover">
        <div className="cover-info cover-info-centered cover-info-no-characters cover-title-only" style={{ backgroundImage: bannerSettings.image ? `linear-gradient(120deg, rgba(8,35,57,.48), rgba(8,35,57,.24)), url("${bannerSettings.image}")` : undefined, backgroundPosition: `${bannerSettings.x}% ${bannerSettings.y}%`, backgroundSize: bannerSettings.zoom <= 100 ? "contain" : `${bannerSettings.zoom}% auto`, backgroundRepeat: "no-repeat", backgroundColor: "#17435b" }}>
          <div className="cover-title-wrap"><h2 style={{ color: bannerSettings.titleColor, fontSize: `clamp(1.5rem, ${bannerSettings.titleSize / 16}vw, ${bannerSettings.titleSize}px)`, fontFamily: bannerSettings.titleFont, textShadow: "0 2px 12px rgba(0,0,0,.72)" }}>{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</h2></div>
        </div>
        {stats.length > 0 && <div className="stats">{stats.map(([label, value]) => <div key={label}><b>{value.toLocaleString("ar-EG")}</b><small>{label}</small></div>)}</div>}
      </section>
      {children}
    </main>
  </div>;
}
