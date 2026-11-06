import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, Role } from "../auth/AuthContext";

type Counts = { users: number; students: number; teachers: number; parents: number; pending: number; lessons: number; classes: number; subjects: number; quizzes: number; assignments: number; submissions: number };
type UserRow = { uid: string; name?: string; email?: string; role?: Role };
type Activity = { id: string; uid?: string; action?: string; target?: string; at?: { toDate?: () => Date } };

const ZERO: Counts = { users: 0, students: 0, teachers: 0, parents: 0, pending: 0, lessons: 0, classes: 0, subjects: 0, quizzes: 0, assignments: 0, submissions: 0 };
const ROLE_NAME: Record<string, string> = { admin: "مدير", teacher: "معلم", student: "طالب", parent: "ولي أمر", pending: "بانتظار الاعتماد" };

export default function AdminOverview({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [pending, setPending] = useState<UserRow[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const stop: (() => void)[] = [];
    const update = (key: keyof Counts, value: number) => setCounts(old => ({ ...old, [key]: value }));
    const fail = () => setLoadError("تعذّر تحميل بعض الإحصائيات. تحقق من اتصال الإنترنت وصلاحيات Firestore.");
    const collections: [string, keyof Counts][] = [
      ["lessons", "lessons"], ["classes", "classes"], ["subjects", "subjects"],
      ["quizzes", "quizzes"], ["assignments", "assignments"], ["submissions", "submissions"]
    ];
    collections.forEach(([name, key]) => stop.push(onSnapshot(collection(db, name), snap => update(key, snap.size), fail)));
    stop.push(onSnapshot(collection(db, "users"), snap => {
      const users = snap.docs.map(d => d.data() as UserRow);
      setCounts(old => ({
        ...old, users: users.length,
        students: users.filter(u => u.role === "student").length,
        teachers: users.filter(u => u.role === "teacher").length,
        parents: users.filter(u => u.role === "parent").length,
        pending: users.filter(u => u.role === "pending").length
      }));
      setPending(users.filter(u => u.role === "pending").sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar")));
      const map: Record<string, string> = {};
      users.forEach(u => { if (u.uid) map[u.uid] = u.name || u.email || u.uid; });
      setNames(map);
    }, fail));
    stop.push(onSnapshot(query(collection(db, "activityLogs"), orderBy("at", "desc"), limit(8)), snap => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
    }, fail));
    return () => stop.forEach(unsubscribe => unsubscribe());
  }, []);

  const cards = useMemo(() => [
    { label: "إجمالي المستخدمين", value: counts.users, icon: "👥", color: "admin-stat-blue" },
    { label: "الطلاب", value: counts.students, icon: "🎓", color: "admin-stat-green" },
    { label: "المعلمون", value: counts.teachers, icon: "👩‍🏫", color: "admin-stat-purple" },
    { label: "طلبات اعتماد المعلمين", value: counts.pending, icon: "⏳", color: "admin-stat-orange" },
    { label: "الدروس", value: counts.lessons, icon: "📚", color: "admin-stat-cyan" },
    { label: "الاختبارات", value: counts.quizzes, icon: "📝", color: "admin-stat-pink" },
    { label: "الواجبات", value: counts.assignments, icon: "📋", color: "admin-stat-yellow" },
    { label: "التسليمات", value: counts.submissions, icon: "📨", color: "admin-stat-indigo" }
  ], [counts]);

  const approve = async (user: UserRow) => {
    if (!user.uid || busy) return;
    setBusy(user.uid); setMessage(null);
    try {
      await updateDoc(doc(db, "users", user.uid), { role: "teacher" });
      await addDoc(collection(db, "activityLogs"), {
        uid: profile!.uid, action: "teacher.approve", target: user.uid, at: serverTimestamp()
      });
      setMessage({ ok: true, text: "تم اعتماد المعلم بنجاح." });
    } catch {
      setMessage({ ok: false, text: "لم يتم الاعتماد. تحقق من صلاحيات المدير واتصال الإنترنت." });
    } finally { setBusy(null); }
  };

  const shortcuts = [
    { id: "users", icon: "👥", title: "إدارة المستخدمين", detail: "اعتماد المعلمين وتحديد الأدوار" },
    { id: "manage", icon: "📚", title: "إدارة المحتوى", detail: "الصفوف والمواد والدروس" },
    { id: "quizzes", icon: "✅", title: "الاختبارات", detail: "إنشاء الاختبارات ومراجعتها" },
    { id: "assignments", icon: "📝", title: "الواجبات", detail: "متابعة التسليمات والدرجات" },
    { id: "site", icon: "🌐", title: "محتوى الموقع", detail: "بيانات التواصل والمدرسون" }
  ];

  return <section className="admin-overview" dir="rtl">
    <div className="admin-welcome">
      <div><span className="admin-eyebrow">لوحة التحكم الرئيسية</span><h2>مرحبًا بك، {profile?.name || "مدير المنصة"} 👋</h2>
        <p>إليك ملخص مباشر لما يحدث داخل منصة المستقبل التعليمية.</p></div>
      <div className="admin-welcome-icon" aria-hidden="true">🛡️</div>
    </div>

    {loadError && <p className="err" role="alert">{loadError}</p>}
    <div className="admin-section-heading"><div><h3>نظرة عامة</h3><p>الإحصائيات تتحدث تلقائيًا من قاعدة البيانات</p></div><span className="admin-live"><i /> مباشر</span></div>
    <div className="admin-stat-grid">{cards.map(card => <article className={`admin-stat-card ${card.color}`} key={card.label}>
      <span className="admin-stat-icon">{card.icon}</span><div><b>{card.value.toLocaleString("ar-EG")}</b><small>{card.label}</small></div>
    </article>)}</div>

    <div className="admin-main-grid">
      <section className="admin-box">
        <div className="admin-box-heading"><div><h3>طلبات المعلمين</h3><p>طلبات تنتظر مراجعة الإدارة</p></div><span className="admin-count">{pending.length}</span></div>
        {pending.length === 0 ? <div className="admin-empty"><span>🎉</span><b>لا توجد طلبات معلّقة</b><small>ستظهر طلبات المعلمين الجديدة هنا.</small></div> :
          <div className="admin-pending-list">{pending.slice(0, 6).map(user => <div className="admin-pending-row" key={user.uid}>
            <div className="admin-avatar">{(user.name || "م").trim().charAt(0)}</div>
            <div className="admin-user-meta"><b>{user.name || "معلم جديد"}</b><small dir="ltr">{user.email || user.uid}</small></div>
            <button className="btn admin-approve" disabled={busy !== null} onClick={() => approve(user)}>{busy === user.uid ? "جارٍ الاعتماد…" : "اعتماد"}</button>
          </div>)}
          {pending.length > 6 && <button className="link" onClick={() => onNavigate("users")}>عرض كل الطلبات ({pending.length})</button>}</div>}
      </section>

      <section className="admin-box">
        <div className="admin-box-heading"><div><h3>الوصول السريع</h3><p>انتقل مباشرة إلى أدوات الإدارة</p></div><span>⚡</span></div>
        <div className="admin-shortcuts">{shortcuts.map(item => <button key={item.id} className="admin-shortcut" onClick={() => onNavigate(item.id)}>
          <span>{item.icon}</span><div><b>{item.title}</b><small>{item.detail}</small></div><i>‹</i>
        </button>)}</div>
      </section>
    </div>

    <section className="admin-box admin-activity">
      <div className="admin-box-heading"><div><h3>آخر الأنشطة</h3><p>أحدث العمليات المسجلة في المنصة</p></div><span>🕘</span></div>
      {activity.length === 0 ? <p className="admin-muted">لا توجد أنشطة مسجلة حتى الآن.</p> : <div className="admin-activity-list">
        {activity.map(item => <div className="admin-activity-row" key={item.id}>
          <span className="admin-activity-dot" />
          <div><b>{item.action || "عملية إدارية"}</b><small>{names[item.uid || ""] || "مستخدم"}{item.target ? ` · ${item.target}` : ""}</small></div>
          <time>{item.at?.toDate ? item.at.toDate().toLocaleString("ar-EG") : "—"}</time>
        </div>)}
      </div>}
    </section>
    {message && <p className={message.ok ? "ok" : "err"} role="status">{message.text}</p>}
    <div className="admin-footer-note">🔒 تظهر أدوات الإدارة لحسابات المدير المعتمدة فقط.</div>
  </section>;
}
