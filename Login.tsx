import { useState, FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
const msg = (e: any) => ({ "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة", "auth/email-already-in-use": "هذا البريد مسجّل بالفعل", "auth/weak-password": "كلمة المرور يجب ألا تقل عن 6 أحرف" } as Record<string,string>)[e?.code] ?? "حدث خطأ، حاول مرة أخرى";
export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", pass: "", role: "student" as "student" | "parent" | "pending" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault(); setErr(""); setBusy(true);
    try { mode === "in" ? await login(f.email, f.pass) : await register(f.name, f.email, f.pass, f.role); }
    catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  return (<main className="wrap narrow"><form onSubmit={submit} className="panel">
    <h2>{mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}</h2>
    {mode === "up" && <><input required placeholder="الاسم" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <select value={f.role} onChange={e => setF({ ...f, role: e.target.value as any })}><option value="student">طالب</option><option value="parent">ولي أمر</option><option value="pending">معلم (يحتاج اعتماد الإدارة)</option></select></>}
    <input required type="email" placeholder="البريد الإلكتروني" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
    <input required type="password" minLength={6} placeholder="كلمة المرور" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} />
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn" disabled={busy}>{busy ? "لحظة…" : mode === "in" ? "دخول" : "إنشاء الحساب"}</button>
    <button type="button" className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "ليس لدي حساب" : "لدي حساب بالفعل"}</button>
  </form></main>);
}
