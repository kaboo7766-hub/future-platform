import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, Role } from "../auth/AuthContext";

interface U { uid: string; name?: string; email?: string; role: Role; classIds?: string[] }\ninterface C { id: string; name: string }
interface L { id: string; parentUid: string; studentUid: string }
const roles: Record<Role, string> = { admin: "مدير", teacher: "معلم", student: "طالب", parent: "ولي أمر", pending: "معلم قيد الاعتماد" };
const roleOptions: Role[] = ["student", "teacher", "parent", "pending", "admin"];

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<U[]>([]);\n  const [classes, setClasses] = useState<C[]>([]);
  const [links, setLinks] = useState<L[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [parentUid, setParentUid] = useState("");
  const [studentUid, setStudentUid] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    const stopUsers = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => d.data() as U));
      setLoading(false);
    }, () => { setLoading(false); setMsg({ ok: false, t: "تعذّر تحميل المستخدمين. تحقق من صلاحيات Firestore." }); });
    const stopClasses = onSnapshot(collection(db, "classes"), snap => {\n      setClasses(snap.docs.map(d => ({ id: d.id, name: String(d.data().name || "صف") })));\n    }, () => setMsg({ ok: false, t: "تعذّر تحميل الصفوف الدراسية." }));\n    const stopLinks = onSnapshot(collection(db, "parentLinks"), snap => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() } as L)));
    }, () => setMsg({ ok: false, t: "تعذّر تحميل روابط أولياء الأمور." }));
    return () => { stopUsers(); stopLinks(); stopClasses(); };
  }, []);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return users.filter(u => (filter === "all" || u.role === filter) &&
      (!q || (u.name || "").toLocaleLowerCase().includes(q) || (u.email || "").toLocaleLowerCase().includes(q) || u.uid.toLowerCase().includes(q)));
  }, [users, search, filter]);

  const displayName = (uid: string) => users.find(u => u.uid === uid)?.name || users.find(u => u.uid === uid)?.email || uid;
  const writeLog = async (action: string, target: string) => {
    if (!profile?.uid) return;
    await addDoc(collection(db, "activityLogs"), { uid: profile.uid, action, target, at: serverTimestamp() });
  };

  const setRole = async (user: U, role: Role) => {
    if (!user.uid || busy) return;
    if (user.uid === profile?.uid && role !== "admin") {
      setMsg({ ok: false, t: "لا يمكن تغيير صلاحية حساب المدير الذي تستخدمه حاليًا." });
      return;
    }
    setBusy(user.uid); setMsg(null);
    try {
      await updateDoc(doc(db, "users", user.uid), { role });
      let logWarning = "";
      try { await writeLog(role === "teacher" && user.role === "pending" ? "teacher.approve" : "user.role", user.uid); }
      catch { logWarning = " (تعذّر تسجيل العملية في سجل الأنشطة)"; }
      setMsg({ ok: true, t: `تم تحديث صلاحية ${displayName(user.uid)} بنجاح.${logWarning}` });
    } catch {
      setMsg({ ok: false, t: "تعذّر تغيير الصلاحية. تحقق من اتصال الإنترنت وقواعد Firestore." });
    } finally { setBusy(null); }
  };

  const linkParent = async () => {
    if (!parentUid || !studentUid) {
      setMsg({ ok: false, t: "اختر ولي الأمر والطالب أولًا." });
      return;
    }
    const id = `${parentUid}_${studentUid}`;
    setBusy(id); setMsg(null);
    try {
      await setDoc(doc(db, "parentLinks", id), { parentUid, studentUid, createdAt: serverTimestamp() });
      try { await writeLog("parent.link", id); } catch { /* الرابط تم حفظه بالفعل */ }
      setMsg({ ok: true, t: "تم ربط ولي الأمر بالطالب." });
      setParentUid(""); setStudentUid("");
    } catch {
      setMsg({ ok: false, t: "تعذّر إنشاء الربط. تحقق من صلاحيات المدير." });
    } finally { setBusy(null); }
  };

  const unlinkParent = async (link: L) => {
    if (busy) return;
    setBusy(link.id); setMsg(null);
    try {
      await deleteDoc(doc(db, "parentLinks", link.id));
      try { await writeLog("parent.unlink", link.id); } catch { /* الحذف تم بالفعل */ }
      setMsg({ ok: true, t: "تم إلغاء الربط." });
    } catch { setMsg({ ok: false, t: "تعذّر إلغاء الربط." }); }
    finally { setBusy(null); }
  };

  const count = (role: Role) => users.filter(u => u.role === role).length;

  const toggleTeacherClass = async (user: U, classId: string) => {
    if (user.role !== "teacher" || busy) return;
    const current = user.classIds ?? [];
    const next = current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId];
    setBusy(user.uid); setMsg(null);
    try {
      await updateDoc(doc(db, "users", user.uid), { classIds: next });
      setUsers(old => old.map(item => item.uid === user.uid ? { ...item, classIds: next } : item));
      setMsg({ ok: true, t: "تم تحديث الصفوف المخصصة للمعلم." });
    } catch {
      setMsg({ ok: false, t: "تعذّر حفظ الصفوف. تحقق من قواعد Firestore." });
    } finally { setBusy(null); }
  };

  return (<section className="panel" dir="rtl">
    <div className="admin-box-heading"><div><h3>إدارة المستخدمين</h3><p>البحث في الحسابات ومراجعة الصلاحيات وطلبات المعلمين</p></div><b>{users.length.toLocaleString("ar-EG")} حساب</b></div>
    <div className="admin-stat-grid">
      {(["student", "teacher", "parent", "pending"] as Role[]).map(role => <article className="admin-stat-card admin-stat-blue" key={role}>
        <div><b>{count(role).toLocaleString("ar-EG")}</b><small>{roles[role]}</small></div>
      </article>)}
    </div>
    {loading ? <p>جارٍ تحميل المستخدمين…</p> : <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input aria-label="البحث عن مستخدم" placeholder="ابحث بالاسم أو البريد أو UID" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="تصفية حسب الدور" value={filter} onChange={e => setFilter(e.target.value as "all" | Role)}>
          <option value="all">كل الأدوار</option>
          {roleOptions.map(role => <option key={role} value={role}>{roles[role]}</option>)}
        </select>
      </div>
      {users.filter(u => u.role === "pending").length > 0 && <section className="admin-box">
        <h3>طلبات اعتماد المعلمين ({count("pending")})</h3>
        {users.filter(u => u.role === "pending").map(u => <div className="row" key={u.uid}>
          <span style={{ flex: 1 }}>{u.name || "معلم جديد"} <small dir="ltr">{u.email}</small></span>
          <button className="btn" disabled={busy !== null} onClick={() => setRole(u, "teacher")}>{busy === u.uid ? "جارٍ الاعتماد…" : "اعتماد كمعلم"}</button>
        </div>)}
      </section>}
      <h3>كل الحسابات ({visibleUsers.length})</h3>
      {visibleUsers.length === 0 ? <p className="note">لا توجد حسابات تطابق البحث.</p> : visibleUsers.map(u => <div className="row" key={u.uid}>
        <span style={{ flex: 1, minWidth: 150 }}>{u.name || "بدون اسم"}<small dir="ltr" style={{ display: "block" }}>{u.email || u.uid}</small></span>
        <select aria-label={`صلاحية ${u.name || u.email || u.uid}`} value={u.role} disabled={u.uid === profile?.uid || busy !== null}
          onChange={e => setRole(u, e.target.value as Role)}>
          {roleOptions.map(role => <option key={role} value={role}>{roles[role]}</option>)}
        </select>
      </div>)}
    </>}
    <section className="admin-box">
      <h3>ربط ولي أمر بطالب</h3>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <select value={parentUid} onChange={e => setParentUid(e.target.value)}><option value="">اختر ولي الأمر</option>
          {users.filter(u => u.role === "parent").map(u => <option key={u.uid} value={u.uid}>{u.name || u.email}</option>)}</select>
        <select value={studentUid} onChange={e => setStudentUid(e.target.value)}><option value="">اختر الطالب</option>
          {users.filter(u => u.role === "student").map(u => <option key={u.uid} value={u.uid}>{u.name || u.email}</option>)}</select>
        <button className="btn" disabled={busy !== null} onClick={linkParent}>{busy && busy === `${parentUid}_${studentUid}` ? "جارٍ الربط…" : "ربط الحسابين"}</button>
      </div>
      <h4>الروابط الحالية ({links.length})</h4>
      {links.length === 0 ? <p className="note">لا توجد روابط حتى الآن.</p> : <div>{links.map(link => <span key={link.id} className="chip">
        {displayName(link.parentUid)} ← {displayName(link.studentUid)}
        <button aria-label="إلغاء الربط" disabled={busy !== null} onClick={() => unlinkParent(link)}>×</button>
      </span>)}</div>}
    </section>
    {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.t}</p>}
  </section>);
}
