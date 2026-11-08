import { ReactNode, useState } from "react";
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
  const { language, toggleLanguage } = useLanguage();
  const choose = (id: string) => { onView(id); setMenuOpen(false); };
  const isAdmin = role === "admin";
  const points = stats.find(([label]) => label === "نقاطي")?.[1];
  const studentSections = isAdmin
    ? nav.filter(item => ["home", "lessons", "games", "quizzes", "learning", "live", "assignments"].includes(item.id))
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
        <div className="cover-info cover-info-centered">
          <svg className="cover-kids" viewBox="0 0 360 150" role="img" aria-label="طفل وطفلة يقرآن كتابًا معًا">
            <defs><linearGradient id="bookGrad" x1="0" x2="1"><stop offset="0" stopColor="#f3c969"/><stop offset="1" stopColor="#fff0b8"/></linearGradient></defs>
            <path d="M180 117 Q135 94 83 111 L83 137 Q133 121 180 143 Q227 121 277 137 L277 111 Q225 94 180 117Z" fill="url(#bookGrad)" stroke="#a97727" strokeWidth="3"/>
            <path d="M180 117V142" stroke="#a97727" strokeWidth="2"/>
            <circle cx="112" cy="44" r="23" fill="#b87545"/><path d="M89 43Q91 12 119 19Q139 26 135 47Q119 31 89 43Z" fill="#3b2930"/>
            <circle cx="248" cy="44" r="23" fill="#d99a68"/><path d="M224 43Q225 13 251 18Q276 23 271 49Q257 28 224 43Z" fill="#4a2d35"/>
            <circle cx="104" cy="47" r="2.8" fill="#17233b"/><circle cx="120" cy="47" r="2.8" fill="#17233b"/><path d="M105 57Q112 64 120 57" fill="none" stroke="#8c3d35" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="240" cy="47" r="2.8" fill="#17233b"/><circle cx="256" cy="47" r="2.8" fill="#17233b"/><path d="M241 57Q248 64 256 57" fill="none" stroke="#8c3d35" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M82 105Q83 73 112 72Q143 72 145 111L145 117L78 117Z" fill="#23649a"/><path d="M215 111Q218 72 248 72Q278 72 282 105L286 117L215 117Z" fill="#b64f86"/>
            <path d="M145 99L180 117L215 99L215 140Q180 125 145 140Z" fill="#fff8df" stroke="#a97727" strokeWidth="2"/>
            <path d="M145 99L180 117L215 99" fill="none" stroke="#a97727" strokeWidth="2"/>
            <path d="M159 106L175 114M201 114L209 107" stroke="#d6b66f" strokeWidth="2"/>
            <path d="M75 20L83 6L91 20M269 17L277 4L285 17" fill="none" stroke="#d5a746" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div className="cover-title-wrap"><h2>{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</h2><p>{name} — {roleLabel}</p></div>
        </div>
        {stats.length > 0 && <div className="stats">{stats.map(([label, value]) => <div key={label}><b>{value.toLocaleString("ar-EG")}</b><small>{label}</small></div>)}</div>}
      </section>
      {children}
    </main>
  </div>;
}
