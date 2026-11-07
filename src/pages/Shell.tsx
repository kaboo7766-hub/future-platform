import { ReactNode, useState } from "react";
import { useLanguage } from "../i18n";
export interface NavItem { id: string; icon: string; label: string }
interface Props { name: string; roleLabel: string; nav: NavItem[]; view: string; onView: (id: string) => void; stats: [string, number][]; onLogout: () => void; children?: ReactNode }
export default function Shell({ name, roleLabel, nav, view, onView, stats, onLogout, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const choose = (id: string) => { onView(id); setMenuOpen(false); };
  return (<div className="app">
    <header className="topbar">
      <b>🌟 {language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</b>
      <span className="who">{name} · {roleLabel}</span>
      <div className="topbar-actions">
        <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{language === "ar" ? "English" : "العربية"} 🌐</button>
        <button className="top-logout" onClick={onLogout}>{language === "ar" ? "تسجيل الخروج" : "Log out"}</button>
        {nav.some(n => n.id === "games") && <button className="games-direct" type="button" onClick={() => choose("games")}>🎮 {language === "ar" ? "الألعاب" : "Games"}</button>}
        <button className={`menu-toggle ${menuOpen ? "is-open" : ""}`} type="button" aria-label={language === "ar" ? "فتح القائمة" : "Open menu"} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(v => !v)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
    <aside id="dashboard-navigation" className={`side ${menuOpen ? "menu-open" : ""}`} aria-label={language === "ar" ? "القائمة الرئيسية" : "Main navigation"}>
      {nav.map(n => <button key={n.id} className={view === n.id ? "on" : ""} aria-current={view === n.id ? "page" : undefined} onClick={() => choose(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>)}
    </aside>
    {menuOpen && <button className="menu-backdrop" aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"} onClick={() => setMenuOpen(false)} />}
    <div className="content">
      <section className="cover"><div className="cover-art" aria-hidden="true">🦉 🤖 ⭐</div>
        <div className="cover-info"><div className="logo" aria-hidden="true">🌟</div><div><h2>{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</h2><p>{name} — {roleLabel}</p></div></div>
        {stats.length > 0 && <div className="stats">{stats.map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}</div>}</section>
      {children}
    </div></div>);
}
