import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, Role } from "../auth/AuthContext";
interface U { uid: string; name: string; email: string; role: Role }
interface L { id: string; parentUid: string; studentUid: string }
const roles: Record<Role, string> = { admin: "مدير", teacher: "معلم", student: "طالب", parent: "ولي أمر", pending: "معلم قيد الاعتماد" };

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<U[]>([]); const [links, setLinks] = useState<L[]>([]);
  const [p, setP] = useState(""), [st, setSt] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    const a = onSnapshot(collection(db, "users"), s => setUsers(s.docs.map(d => d.data() as U)), () => setMsg({ ok: false, t: "تعذّر تحميل المستخدمين" }));
    const b = onSnapshot(collection(db, "parentLinks"), s => setLinks(s.docs.map(d => ({ id: d.id, ...d.data() } as L))));
    return () => { a(); b(); };
  }, []);
  const name = (uid: string) => users.find(u => u.uid === uid)?.name ?? uid;
  const log = (action: string, target: string) => addDoc(collection(db, "activityLogs"), { uid: profile!.uid, action, target, at: serverTimestamp() });
  const setRole = async (u: U, role: Role) => {
    try { await updateDoc(doc(db, "users", u.uid), { role }); await log("user.role", u.uid); setMsg({ ok: true, t: "تم تغيير الدور" }); }
    catch { setMsg({ ok: false, t: "تعذّر تغيير الدور" }); }
  };
  const link = async () => {
    if (!p || !st) return setMsg({ ok: false, t: "اختر ولي الأمر والطالب" });
    try { await setDoc(doc(db, "parentLinks", `${p}_${st}`), { parentUid: p, studentUid: st }); await log("parent.link", `${p}_${st}`); setMsg({ ok: true, t: "تم الربط" }); }
    catch { setMsg({ ok: false, t: "تعذّر الربط" }); }
  };
  return (<section className="panel"><h3>المستخدمون</h3>
    {users.filter(u => u.role === "pending").map(u => (<div className="row ok" key={"p" + u.uid}><span style={{ flex: 1 }}>طلب معلم: {u.name} <small dir="ltr">{u.email}</small></span>
      <button className="btn" onClick={() => setRole(u, "teacher")}>اعتماد كمعلم</button></div>))}
    {users.map(u => (<div className="row" key={u.uid}><span style={{ flex: 1 }}>{u.name} <small dir="ltr">{u.email}</small></span>
      <select value={u.role} disabled={u.uid === profile!.uid} onChange={e => setRole(u, e.target.value as Role)}>
        {(Object.keys(roles) as Role[]).map(r => <option key={r} value={r}>{roles[r]}</option>)}</select></div>))}
    <h3>ربط ولي أمر بطالب</h3>
    <div className="row"><select value={p} onChange={e => setP(e.target.value)}><option value="">ولي الأمر</option>{users.filter(u => u.role === "parent").map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}</select>
      <select value={st} onChange={e => setSt(e.target.value)}><option value="">الطالب</option>{users.filter(u => u.role === "student").map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}</select>
      <button className="btn" onClick={link}>ربط</button></div>
    <p>{links.map(l => <span key={l.id} className="chip">{name(l.parentUid)} ← {name(l.studentUid)}
      <button aria-label="حذف الربط" onClick={() => deleteDoc(doc(db, "parentLinks", l.id))}>×</button></span>)}</p>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
  </section>);
}
