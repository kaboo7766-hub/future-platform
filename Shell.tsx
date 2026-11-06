import { ReactNode } from "react";
export interface NavItem { id: string; icon: string; label: string }
interface Props { name: string; roleLabel: string; nav: NavItem[]; view: string; onView: (id: string) => void; stats: [string, number][]; onLogout: () => void; children?: ReactNode }
export default function Shell({ name, roleLabel, nav, view, onView, stats, onLogout, children }: Props) {
  return (<div className="app">
    <header className="topbar"><b>🌟 منصة المستقبل التعليمية</b><span className="who">{name} · {roleLabel}</span><button onClick={onLogout}>تسجيل الخروج</button></header>
    <aside className="side" aria-label="القائمة الرئيسية">{nav.map(n => (
      <button key={n.id} className={view === n.id ? "on" : ""} aria-current={view === n.id ? "page" : undefined} onClick={() => onView(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>))}</aside>
    <div className="content">
      <section className="cover"><div className="cover-art" aria-hidden="true">🦉 🤖 ⭐</div>
        <div className="cover-info"><div className="logo" aria-hidden="true">🌟</div><div><h2>منصة المستقبل التعليمية</h2><p>{name} — {roleLabel}</p></div></div>
        {stats.length > 0 && <div className="stats">{stats.map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}</div>}</section>
      {children}
    </div></div>);
}
