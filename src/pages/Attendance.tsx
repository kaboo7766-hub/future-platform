import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
interface AttendanceRow { id: string; uid: string; userName: string; role: string; lessonTitle: string; classId?: string; dateKey: string; enteredAt?: { toDate?: () => Date } }
export default function Attendance() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => onSnapshot(query(collection(db, "attendance"), orderBy("enteredAt", "desc"), limit(200)),
    s => { setRows(s.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRow))); setError(""); },
    () => setError("تعذّر تحميل سجل الحضور. تأكد من نشر قواعد Firestore الجديدة.")), []);
  const roleName = (role: string) => role === "student" ? "طالب" : role === "teacher" ? "معلم" : "مدير";
  return <section className="panel">
    <h2>سجل حضور المعلمين والطلاب</h2>
    <p className="note">يُسجَّل الحضور تلقائيًا عند فتح الدرس، مرة واحدة لكل مستخدم في الدرس خلال اليوم.</p>
    {error && <p className="err">{error}</p>}
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
