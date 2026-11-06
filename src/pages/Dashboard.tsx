import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth, Role } from "../auth/AuthContext";
import Shell from "./Shell";
import Lessons from "./Lessons";
import Manage from "./Manage";
import QuizBuilder from "./QuizBuilder";
import Users from "./Users";
import Parent from "./Parent";
import ClassPicker from "./ClassPicker";
import Games from "./Games";
import Certificates from "./Certificates";
import Notifications from "./Notifications";
import Assignments from "./Assignments";
import Onboarding from "./Onboarding";
import SiteContent from "./SiteContent";
import { useSite, contactLinks } from "./HomeExtras";

type View = "home" | "lessons" | "assignments" | "games" | "certs" | "manage" | "quizzes" | "users" | "site";
const ALL: Record<View, [string, string]> = {
  home: ["🏠", "الرئيسية"], lessons: ["📚", "الدروس"], assignments: ["📝", "الواجبات"], games: ["🎮", "الألعاب"], certs: ["🏆", "شهاداتي"],
  manage: ["🧩", "الدروس والصفوف"], quizzes: ["✅", "الاختبارات"], users: ["👥", "المستخدمون"], site: ["🌐", "محتوى الموقع"],
};
const NAV: Partial<Record<Role, View[]>> = {
  student: ["home", "lessons", "assignments", "games", "certs"], parent: ["home"],
  teacher: ["home", "manage", "quizzes", "assignments"], admin: ["home", "manage", "quizzes", "assignments", "users", "site"],
};
const ROLE: Record<Role, string> = { admin: "مدير", teacher: "معلم", student: "طالب", parent: "ولي أمر", pending: "معلم قيد الاعتماد" };
const TILE = ["c0", "c1", "c2", "c3"];

function useStats(role: Role, uid: string): [string, number][] {
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
    if (role === "teacher" || role === "admin") {
      un.push(onSnapshot(collection(db, "lessons"), s => put("lessons", s.docs.length), e));
      un.push(onSnapshot(collection(db, "assignments"), s => put("assigns", s.docs.length), e));
      un.push(onSnapshot(collection(db, "submissions"), s => put("subs", s.docs.length), e));
    }
    if (role === "admin") un.push(onSnapshot(collection(db, "users"), s => { put("users", s.docs.length); put("pending", s.docs.filter(d => d.data().role === "pending").length); }, e));
    return () => un.forEach(f => f());
  }, [role, uid]);
  const g = (k: string) => n[k] ?? 0;
  if (role === "student") return [["دروس مكتملة", g("done")], ["نقاطي", g("pts")], ["شهاداتي", g("certs")], ["واجبات مسلّمة", g("subs")]];
  if (role === "parent") return [["الأبناء المرتبطون", g("kids")]];
  if (role === "teacher") return [["الدروس", g("lessons")], ["الواجبات", g("assigns")], ["التسليمات", g("subs")]];
  if (role === "admin") return [["المستخدمون", g("users")], ["معلمون بانتظار الاعتماد", g("pending")], ["الدروس", g("lessons")], ["الواجبات", g("assigns")]];
  return [];
}

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const [view, setView] = useState<View>("home");
  const { c } = useSite();
  const role = profile?.role ?? "pending", stats = useStats(role, profile?.uid ?? "");
  if (!profile) return null;
  if (role === "pending") return (<main className="wrap"><section className="panel"><h2>أهلًا {profile.name} 👋</h2>
    <p>استلمنا طلبك للانضمام كمعلم. ستظهر لك أدوات المعلم بعد اعتماد إدارة المنصة لحسابك. سجّل الدخول لاحقًا للتحقق.</p>
    <button className="btn" onClick={logout}>تسجيل الخروج</button></section></main>);
  const staff = role === "admin" || role === "teacher";
  const nav = (NAV[role] ?? ["home"]).map(id => ({ id, icon: ALL[id][0], label: ALL[id][1] }));
  const links = contactLinks(c);
  return (<>
    {!profile.onboarded && <Onboarding />}
    <Shell name={profile.name} roleLabel={ROLE[role]} nav={nav} view={view} onView={id => setView(id as View)} stats={stats} onLogout={logout}>
      {view === "home" && <div className="cols">
        <div><h3>اختصارات</h3>{nav.filter(n => n.id !== "home").map((n, i) => (
          <button key={n.id} className={`tile ${TILE[i % 4]}`} onClick={() => setView(n.id as View)}><span>{n.icon}</span>{n.label}</button>))}
          {nav.length === 1 && <p className="note">لا توجد اختصارات إضافية لهذا الحساب.</p>}</div>
        <div><Notifications />{role === "parent" && <Parent />}</div>
        <div>{links.length > 0 && <section className="panel"><h3>كن على اطلاع</h3><div className="contact">{links.map(l => (
          <a key={l.href} className="btn" href={l.href} {...(l.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>))}</div></section>}</div>
      </div>}
      {view === "lessons" && <>{role === "student" && <ClassPicker />}<Lessons staff={staff} /></>}
      {view === "assignments" && <Assignments staff={staff} />}
      {view === "games" && <Games />}
      {view === "certs" && <><Certificates /><p className="note">عند إكمال كل دروس مادة تظهر لك شهادتها هنا.</p></>}
      {view === "manage" && <><Manage isAdmin={role === "admin"} /><Lessons staff /></>}
      {view === "quizzes" && <QuizBuilder />}
      {view === "users" && <Users />}
      {view === "site" && <SiteContent />}
    </Shell>
  </>);
}
