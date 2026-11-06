import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
interface N { id: string; title: string; body: string; ms: number }
const getSeen = (k: string) => { try { return Number(localStorage.getItem(k) || 0); } catch { return 0; } };

export default function Notifications() {
  const { profile } = useAuth(); const uid = profile!.uid;
  const staff = profile!.role === "admin" || profile!.role === "teacher";
  const key = `seen_${uid}`;
  const [items, setItems] = useState<N[]>([]); const [seen, setSeen] = useState(getSeen(key)); const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "" }); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    const m: Record<string, N[]> = { a: [], b: [] };
    const push = () => setItems([...m.a, ...m.b].sort((x, y) => y.ms - x.ms).slice(0, 30));
    const conv = (s: QuerySnapshot<DocumentData>) => s.docs.map(d => ({ id: d.id, title: d.data().title, body: d.data().body, ms: d.data().at?.toMillis?.() ?? Date.now() }));
    const u1 = onSnapshot(query(collection(db, "notifications"), where("audience", "==", "all")), s => { m.a = conv(s); push(); }, () => {});
    const u2 = onSnapshot(query(collection(db, "notifications"), where("audience", "==", uid)), s => { m.b = conv(s); push(); }, () => {});
    return () => { u1(); u2(); };
  }, [uid]);
  const unread = items.filter(n => n.ms > seen).length;
  const toggle = () => { if (!open) { const t = Date.now(); setSeen(t); try { localStorage.setItem(key, String(t)); } catch { /* ignore */ } } setOpen(!open); };
  const send = async () => {
    if (!f.title.trim()) return setMsg({ ok: false, t: "اكتب عنوان الإعلان" });
    try { await addDoc(collection(db, "notifications"), { audience: "all", title: f.title.trim(), body: f.body.trim(), at: serverTimestamp(), createdBy: uid }); setF({ title: "", body: "" }); setMsg({ ok: true, t: "تم إرسال الإعلان" }); }
    catch { setMsg({ ok: false, t: "تعذّر الإرسال" }); }
  };
  return (<section className="panel">
    <button className="btn" onClick={toggle} aria-expanded={open}>🔔 الإشعارات{unread > 0 && ` (${unread} جديد)`}</button>
    {open && <div>{items.length === 0 ? <p className="note">لا توجد إشعارات.</p> : items.map(n => <p key={n.id}><b>{n.title}</b><br /><small>{n.body}</small></p>)}</div>}
    {staff && <details><summary>إرسال إعلان عام</summary>
      <input placeholder="العنوان" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <textarea placeholder="نص الإعلان" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
      <button className="btn" onClick={send}>إرسال للجميع</button>
      {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}</details>}
  </section>);
}
