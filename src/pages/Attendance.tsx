import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase";
interface AttendanceRow { id: string; uid: string; userName: string; role: string; lessonTitle: string; classId?: string; dateKey: string; enteredAt?: { toDate?: () => Date } }
interface StudentRow { uid: string; name?: string; classId?: string }
interface ProgressRow { uid: string; lessonId: string; completed?: boolean }
export default function Attendance() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const ids = profile?.classIds ?? [];
    const attendanceQuery = profile?.role === "admin"
      ? query(collection(db, "attendance"), orderBy("enteredAt", "desc"), limit(200))
      : ids.length
        ? query(collection(db, "attendance"), where("classId", "in", ids.slice(0, 30)), orderBy("enteredAt", "desc"), limit(200))
        : query(collection(db, "attendance"), where("classId", "==", "__none__"), orderBy("enteredAt", "desc"), limit(200));
    const studentsQuery = profile?.role === "admin"
      ? query(collection(db, "users"), where("role", "==", "student"))
      : ids.length
        ? query(collection(db, "users"), where("classId", "in", ids.slice(0, 30)), where("role", "==", "student"))
        : query(collection(db, "users"), where("classId", "==", "__none__"), where("role", "==", "student"));
    const progressQuery = profile?.role === "admin" ? collection(db, "progress")
      : ids.length ? query(collection(db, "progress"), where("classId", "in", ids.slice(0, 30)))
      : query(collection(db, "progress"), where("classId", "==", "__none__"));
    const stopAttendance = onSnapshot(attendanceQuery,
      snap => { setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRow))); setError(""); },
      () => setError("تعذّر تحميل سجل حضور الصفوف المخصصة. تأكد من نشر قواعد Firestore الجديدة."));
    const stopStudents = onSnapshot(studentsQuery,
      snap => setStudents(snap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentRow))),
      () => setError("تعذّر تحميل قائمة طلاب الصفوف المخصصة."));
    const stopProgress = onSnapshot(progressQuery,
      snap => setProgress(snap.docs.map(d => d.data() as ProgressRow)),
      () => setError("تعذّر تحميل تقدم الطلاب."));
    return () => { stopAttendance(); stopStudents(); stopProgress(); };
  }, [profile?.role, profile?.classIds]);
  const roleName = (role: string) => role === "student" ? "طالب" : role === "teacher" ? "معلم" : "مدير";
  return <section className="panel">
    <h2>سجل حضور المعلمين والطلاب</h2>
    <p className="note">يُسجَّل الحضور تلقائيًا عند فتح الدرس، مرة واحدة لكل مستخدم في الدرس خلال اليوم.</p>
    {error && <p className="err">{error}</p>}
    <h3>متابعة تقدم الطلاب</h3>
    <p className="note">طلاب الصفوف المخصصة لك وعدد الدروس التي أكملها كل طالب.</p>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
      <thead><tr><th>الطالب</th><th>الدروس المكتملة</th><th>الدروس التي بدأها</th></tr></thead>
      <tbody>{students.map(student => {
        const items = progress.filter(item => item.uid === student.uid);
        const done = items.filter(item => item.completed).length;
        return <tr key={student.uid}><td>{student.name || student.uid}</td><td>{done}</td><td>{items.length}</td></tr>;
      })}</tbody>
    </table></div>
    {!students.length && <p className="note">لا يوجد طلاب في الصفوف المخصصة حتى الآن.</p>}
    <h3>سجل الحضور</h3>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
      <thead><tr><th>الاسم</th><th>الصفة</th><th>الدرس</th><th>التاريخ</th><th>الوقت</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}>
        <td>{r.userName}</td><td>{roleName(r.role)}</td><td>{r.lessonTitle}</td><td>{r.dateKey}</td>
        <td>{r.enteredAt?.toDate ? r.enteredAt.toDate().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
      </tr>)}</tbody>
    </table></div>
    {!rows.length && !error && <p className="note">لا توجد سجلات حضور حتى الآن.</p>}
  </section>;
}
