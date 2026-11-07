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
      <b>{language === "ar" ? "منصة المستقبل التعليمية" : "Future Learning Platform"}</b>
      <span className="who">{name} · {roleLabel}</span>
      <div className="topbar-actions">
        <button className="top-logout" onClick={onLogout}>{language === "ar" ? "تسجيل الخروج" : "Log out"}</button>
        <button className="language-switch" type="button" onClick={toggleLanguage} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{language === "ar" ? "English" : "العربية"} 🌐</button>
        <button className={`menu-toggle ${menuOpen ? "is-open" : ""}`} type="button" aria-label={language === "ar" ? "فتح القائمة" : "Open menu"} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(v => !v)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
    {nav.some(n => n.id === "games") && <button className="games-float" type="button" onClick={() => choose("games")} aria-label={language === "ar" ? "فتح الألعاب" : "Open games"}>🎮 <span>{language === "ar" ? "الألعاب" : "Games"}</span></button>}
    <aside id="dashboard-navigation" className={`side ${menuOpen ? "menu-open" : ""}`} aria-label={language === "ar" ? "القائمة الرئيسية" : "Main navigation"}>
      {nav.map(n => <button key={n.id} className={view === n.id ? "on" : ""} aria-current={view === n.id ? "page" : undefined} onClick={() => choose(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>)}
    </aside>
    {menuOpen && <button className="menu-backdrop" aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"} onClick={() => setMenuOpen(false)} />}
    <div className="content">
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
        {stats.length > 0 && <div className="stats">{stats.map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}</div>}</section>
      {children}
    </div></div>);
}
