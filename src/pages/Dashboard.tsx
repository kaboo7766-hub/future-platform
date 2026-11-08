import { lazy, Suspense, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, Role } from "../auth/AuthContext";
import Shell from "./Shell";
const Lessons = lazy(() => import("./Lessons"));
const Manage = lazy(() => import("./Manage"));
const QuizBuilder = lazy(() => import("./QuizBuilder"));
const Users = lazy(() => import("./Users"));
const Teachers = lazy(() => import("./Teachers"));
const Parent = lazy(() => import("./Parent"));
const ClassPicker = lazy(() => import("./ClassPicker"));
const Games = lazy(() => import("./Games"));
const Certificates = lazy(() => import("./Certificates"));
const Assignments = lazy(() => import("./Assignments"));
const Onboarding = lazy(() => import("./Onboarding"));
const SiteContent = lazy(() => import("./SiteContent"));
const AdminOverview = lazy(() => import("./AdminOverview"));
const Attendance = lazy(() => import("./Attendance"));
const LiveClasses = lazy(() => import("./LiveClasses"));
const LearningTables = lazy(() => import("./LearningTables"));
const ThemeSettings = lazy(() => import("./ThemeSettings"));
import { useSite, contactLinks } from "./HomeExtras";
import SocialFeed from "./SocialFeed";

type View = "admin" | "home" | "lessons" | "assignments" | "games" | "certs" | "manage" | "teachers" | "quizzes" | "users" | "site" | "attendance" | "live" | "learning" | "theme";
const ALL: Record<View, [string, string]> = {
  admin: ["🛡️", "لوحة المدير"], home: ["🏠", "الرئيسية"], lessons: ["📚", "الدروس"], assignments: ["📝", "الواجبات"], games: ["🎮", "الألعاب"], certs: ["🏆", "الشهادات والتكريم"],
  manage: ["🧩", "الدروس والصفوف"], teachers: ["👩‍🏫", "إدارة المعلمين"], quizzes: ["✅", "الاختبارات"], users: ["👥", "المستخدمون"], site: ["🌐", "محتوى الموقع"], attendance: ["🗓️", "الحضور"], live: ["🎥", "الفصول الافتراضية"], learning: ["🔤", "الحروف وجداول الضرب"], theme: ["🎨", "تخصيص ألوان المنصة"],
};
const NAV: Partial<Record<Role, View[]>> = {
  student: ["home", "lessons", "games", "learning", "live", "assignments", "certs"], parent: ["home", "learning", "games"],
  teacher: ["home", "live", "learning", "games", "manage", "certs", "quizzes", "assignments", "attendance"], admin: ["admin", "home", "live", "learning", "games", "manage", "teachers", "certs", "quizzes", "assignments", "users", "site", "attendance", "theme"],
};
const ROLE: Record<Role, string> = { admin: "مدير", teacher: "معلم", student: "طالب", parent: "ولي أمر", pending: "معلم قيد الاعتماد" };
const TILE = ["c0", "c1", "c2", "c3"];

function useStats(role: Role, uid: string, classIds: string[] = []): [string, number][] {
  const [n, setN] = useState<Record<string, number>>({});
  useEffect(() => {
    const un: (() => void)[] = [], e = () => {}, put = (k: string, v: number) => setN(p => ({ ...p, [k]: v }));
    if (role === "student") {
      un.push(onSnapshot(query(collection(db, "progress"), where("uid", "==", uid)), s => put("done", s.docs.filter(d => d.data().completed).length), e));
      un.push(onSnapshot(doc(db, "points", uid), s => put("pts", s.data()?.total ?? 0), e));
      un.push(onSnapshot(query(collection(db, "certificates"), where("uid", "==", uid)), s => put("certs", s.docs.length), e));
      un.push(onSnapshot(query(collection(db, "submissions"), where("uid", "==", uid)), s => put("subs", s.docs.length), e));
    }
    if (role === "parent") un.push(onSnapshot(query(collection(db, "parentLinks"), where("parentUid", "==", uid)), s => put("kids", s.docs.length), e));
    if (role === "admin") {
      un.push(onSnapshot(collection(db, "lessons"), s => put("lessons", s.docs.length), e));
      un.push(onSnapshot(collection(db, "assignments"), s => put("assigns", s.docs.length), e));
      un.push(onSnapshot(collection(db, "submissions"), s => put("subs", s.docs.length), e));
      un.push(onSnapshot(collection(db, "users"), s => { put("users", s.docs.length); put("pending", s.docs.filter(d => d.data().role === "pending").length); }, e));
    }
    if (role === "teacher") {
      const ids = classIds.slice(0, 30);
      const scoped = (name: string) => ids.length
        ? query(collection(db, name), where("classId", "in", ids))
        : query(collection(db, name), where("classId", "==", "__none__"));
      un.push(onSnapshot(scoped("lessons"), s => put("lessons", s.docs.length), e));
      un.push(onSnapshot(scoped("assignments"), s => put("assigns", s.docs.length), e));
      un.push(onSnapshot(scoped("submissions"), s => put("subs", s.docs.length), e));
    }
    return () => un.forEach(f => f());
  }, [role, uid, classIds.join("|")]);
  const g = (k: string) => n[k] ?? 0;
  if (role === "student") return [["دروس مكتملة", g("done")], ["نقاطي", g("pts")], ["شهاداتي", g("certs")], ["واجبات مسلّمة", g("subs")]];
  if (role === "parent") return [["الأبناء المرتبطون", g("kids")]];
  if (role === "teacher") return [["الدروس", g("lessons")], ["الواجبات", g("assigns")], ["التسليمات", g("subs")]];
  if (role === "admin") return [["المستخدمون", g("users")], ["معلمون بانتظار الاعتماد", g("pending")], ["الدروس", g("lessons")], ["الواجبات", g("assigns")]];
  return [];
}

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const [view, setView] = useState<View>(profile?.role === "admin" ? "admin" : "home");
  const { c } = useSite();
  const role = profile?.role ?? "pending", stats = useStats(role, profile?.uid ?? "", profile?.classIds ?? []);
  if (!profile) return null;
  if (role === "pending") return (<main className="wrap"><section className="panel"><h2>أهلًا {profile.name} 👋</h2>
    <p>استلمنا طلبك للانضمام كمعلم. ستظهر لك أدوات المعلم بعد اعتماد إدارة المنصة لحسابك. سجّل الدخول لاحقًا للتحقق.</p>
    <button className="btn" onClick={logout}>تسجيل الخروج</button></section></main>);
  const staff = role === "admin" || role === "teacher";
  const nav: import("./Shell").NavItem[] = (NAV[role] ?? ["home"]).map(id => ({ id, icon: ALL[id][0], label: role === "student" ? (({ home: "الرئيسية", lessons: "مقرراتي", games: "الألعاب التعليمية", learning: "المكتبة التفاعلية", live: "الفصول المباشرة", assignments: "الواجبات", certs: "شهاداتي" } as Record<string, string>)[id] ?? ALL[id][1]) : ALL[id][1] }));
  if (role === "student") nav.splice(3, 0, { id: "student-quizzes", icon: "📝", label: "الاختبارات", disabled: true, badge: "قريبًا" }, { id: "student-leaderboard", icon: "🏆", label: "لوحة المتصدرين", disabled: true, badge: "قريبًا" }, { id: "student-chat", icon: "💬", label: "محادثة المعلم", disabled: true, badge: "قريبًا" });
  const adminNav: import("./Shell").NavItem[] = [
    { id: "users", icon: "👥", label: "إدارة المستخدمين" },
    { id: "manage", icon: "📚", label: "إدارة المحتوى والصفوف" },
    { id: "admin", icon: "📊", label: "التحليلات والتقارير" },
    { id: "manage", icon: "✏️", label: "إنشاء الدورات" },
    { id: "admin-finance", icon: "💳", label: "الاشتراكات والمالية", disabled: true, badge: "غير مفعّل" },
    { id: "theme", icon: "⚙️", label: "إعدادات النظام" }
  ];
  const rightNav = role === "admin" ? [
    { id: "home", icon: "🏠", label: "الرئيسية" },
    { id: "lessons", icon: "📚", label: "مقرراتي" },
    { id: "games", icon: "🎮", label: "الألعاب التعليمية" },
    { id: "quizzes", icon: "📝", label: "الاختبارات" },
    { id: "learning", icon: "📖", label: "المكتبة التفاعلية" },
    { id: "live", icon: "🎥", label: "الفصول المباشرة" }
  ] : nav;
  const links = contactLinks(c);
  return (<>
    <Suspense fallback={<section className="panel" role="status">جارٍ تحميل القسم…</section>}>
    {!profile.onboarded && <Onboarding />}
    <Shell name={profile.name} role={role} roleLabel={ROLE[role]} nav={rightNav ?? nav} adminNav={adminNav} view={view} onView={id => setView(id as View)} stats={stats} onLogout={logout}>
      {view === "admin" && role === "admin" && <AdminOverview onNavigate={id => setView(id as View)} />}
      {view === "home" && <div className="social-layout">
        <aside className="social-left"><section className="panel social-shortcuts"><h3>اختصاراتك</h3>{nav.filter(n => n.id !== "home").map((n, i) => (
          <button key={n.id} className={`tile ${TILE[i % 4]}`} onClick={() => setView(n.id as View)}><span>{n.icon}</span>{n.label}</button>))}
          {nav.length === 1 && <p className="note">لا توجد اختصارات إضافية لهذا الحساب.</p>}</section>{role === "parent" && <Parent />}</aside>
        <div className="social-center"><SocialFeed /></div>
        <aside className="social-right">{links.length > 0 && <section className="panel"><h3>تواصل مع المنصة</h3><div className="contact">{links.map(l => (
          <a key={l.href} className="btn" href={l.href} {...(l.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>))}</div></section>}<section className="panel social-welcome"><span>✨</span><b>مساحة آمنة للتعلّم</b><p>شارك التفاعل الإيجابي، وشجّع أصدقاءك على التقدّم.</p></section></aside>
      </div>}
      {view === "lessons" && <>{role === "student" && <ClassPicker />}<Lessons staff={staff} /></>}
      {view === "assignments" && <Assignments staff={staff} />}
      {view === "games" && <Games />}
      {view === "learning" && <LearningTables />}
      {view === "theme" && role === "admin" && <ThemeSettings />}
      {view === "certs" && <><Certificates /></>}
      {view === "manage" && <><Manage isAdmin={role === "admin"} /><Lessons staff /></>}
      {view === "quizzes" && <QuizBuilder />}
      {view === "users" && <Users />}
      {view === "teachers" && role === "admin" && <Teachers />}
      {view === "site" && <SiteContent />}
      {view === "attendance" && staff && <Attendance />}
      {view === "live" && <LiveClasses />}
    </Shell>
    </Suspense>
  </>);
}
