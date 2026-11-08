import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface SchoolClass { id: string; name: string }
interface StudentRow { uid: string; name: string }
interface AccessSession {
  id: string;
  classId: string;
  gameId: string;
  active: boolean;
  selectedStudentUids: string[];
}

export default function GameAccessManager() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [session, setSession] = useState<AccessSession | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = profile?.role;
  const staff = role === "admin" || role === "teacher";
  const allowedClassIds = profile?.classIds ?? [];

  useEffect(() => {
    if (!staff) return;
    return onSnapshot(collection(db, "classes"), snapshot => {
      const rows = snapshot.docs
        .filter(d => role === "admin" || allowedClassIds.includes(d.id))
        .map(d => ({ id: d.id, name: String(d.data().name ?? "صف دراسي") }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));
      setClasses(rows);
      setClassId(current => current && rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ""));
    }, () => setNotice("تعذّر تحميل الصفوف الدراسية."));
  }, [staff, role, allowedClassIds.join("|")]);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    const q = query(collection(db, "users"), where("classId", "==", classId), where("role", "==", "student"));
    return onSnapshot(q, snapshot => setStudents(snapshot.docs.map(d => ({
      uid: d.id, name: String(d.data().name ?? d.data().email ?? "طالب")
    })).sort((a, b) => a.name.localeCompare(b.name, "ar"))), () => setStudents([]));
  }, [classId]);

  useEffect(() => {
    if (!classId) { setSession(null); setSelectedStudents([]); return; }
    return onSnapshot(doc(db, "arcadeGameSessions", classId + "_foundation"), snapshot => {
      if (!snapshot.exists()) {
        setSession(null);
        setSelectedStudents([]);
        return;
      }
      const data = snapshot.data();
      const row: AccessSession = {
        id: snapshot.id, classId: String(data.classId ?? classId), gameId: String(data.gameId ?? ""),
        active: data.active === true,
        selectedStudentUids: Array.isArray(data.selectedStudentUids)
          ? data.selectedStudentUids.filter((v: unknown): v is string => typeof v === "string") : []
      };
      setSession(row);
      setSelectedStudents(row.selectedStudentUids);
    }, () => {
      setSession(null);
      setNotice("تعذّر قراءة حالة فتح الألعاب. تحقق من صلاحيات Firestore.");
    });
  }, [classId]);

  const saveAccess = async () => {
    if (!profile || !classId || busy) return;
    const active = session?.active === true;
    const recipients = active ? (session?.selectedStudentUids ?? selectedStudents) : selectedStudents;
    if (!active && recipients.length === 0) {
      setError(true);
      setNotice("اختر طالبًا واحدًا على الأقل بالاسم قبل فتح الألعاب.");
      return;
    }
    setBusy(true);
    setError(false);
    setNotice("");
    try {
      await setDoc(doc(db, "arcadeGameSessions", classId + "_foundation"), {
        classId, gameId: "foundation", title: "الألعاب التعليمية العامة",
        active: !active, selectedStudentUids: recipients, openedBy: profile.uid,
        updatedAt: serverTimestamp(), ...(!active ? { openedAt: serverTimestamp() } : {})
      }, { merge: true });
      setNotice(active ? "تم إغلاق الألعاب العامة عن الطلاب." : "تم فتح الألعاب العامة للأسماء المحددة فقط.");
    } catch {
      setError(true);
      setNotice("تعذّر حفظ صلاحية الألعاب. انشر تحديث firestore.rules ثم حاول مرة أخرى.");
    } finally { setBusy(false); }
  };

  if (!staff) return null;
  const active = session?.active === true;

  return <section className="admin-box game-access-manager" dir="rtl">
    <div className="admin-box-heading">
      <div><h3>🔐 التحكم في إتاحة الألعاب</h3><p>الألعاب العامة لا تظهر للطلاب إلا بعد اختيار أسمائهم وفتحها لهم.</p></div>
      <span className="chip">{active ? "مفتوحة" : "مغلقة"}</span>
    </div>
    <label className="arcade-field">الصف الدراسي
      <select value={classId} onChange={e => { setClassId(e.target.value); setSelectedStudents([]); setNotice(""); }} disabled={!classes.length}>
        {!classes.length ? <option value="">لا توجد صفوف متاحة</option> : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
    <div className="arcade-student-picker">
      <div className="arcade-picker-head"><b>اختر الطلاب بالاسم</b><span>{selectedStudents.length} محدد</span></div>
      <div className="arcade-picker-actions">
        <button type="button" className="link" onClick={() => setSelectedStudents(students.map(s => s.uid))} disabled={!students.length || active}>تحديد الكل</button>
        <button type="button" className="link" onClick={() => setSelectedStudents([])} disabled={!selectedStudents.length || active}>إلغاء التحديد</button>
      </div>
      <div className="arcade-students">
        {students.map(s => <label key={s.uid}>
          <input type="checkbox" checked={selectedStudents.includes(s.uid)} disabled={active} onChange={e => setSelectedStudents(old => e.target.checked ? [...old, s.uid] : old.filter(id => id !== s.uid))} />
          {s.name}
        </label>)}
        {students.length === 0 && <small>لا يوجد طلاب مسجلون في هذا الصف بعد.</small>}
      </div>
    </div>
    {notice && <p className={error ? "err" : "note"} role="status">{notice}</p>}
    <button type="button" className="btn" disabled={!classId || busy || (!active && !selectedStudents.length)} onClick={() => void saveAccess()}>
      {busy ? "جارٍ الحفظ…" : active ? "إغلاق الألعاب عن الطلاب المحددين" : "فتح الألعاب للطلاب المحددين"}
    </button>
    {active && <p className="note">الألعاب مفتوحة حاليًا لـ {session?.selectedStudentUids.length ?? 0} طالب. لإجراء تعديل، أغلقها أولًا ثم حدّد الأسماء الجديدة.</p>}
  </section>;
}
