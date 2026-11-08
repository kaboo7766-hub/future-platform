import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface Entry {
  rank: number;
  name: string;
  points: number;
  isMe: boolean;
}
interface LeaderboardResponse {
  leaderboard: Entry[];
  me: Entry | null;
  totalStudents: number;
}

export default function StudentLeaderboard() {
  const { profile } = useAuth();
  const classId = profile?.classId ?? "";
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [mine, setMine] = useState<Entry | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.");
        const token = await user.getIdToken();
        const response = await fetch("/api/leaderboard", {
          method: "GET",
          headers: { Authorization: "Bearer " + token }
        });
        const data = await response.json() as LeaderboardResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "تعذّر تحميل لوحة المتصدرين.");
        if (!active) return;
        setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        setMine(data.me ?? null);
        setTotal(Number(data.totalStudents ?? 0));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "حدث خطأ أثناء تحميل الترتيب.");
      }
    };
    if (classId) void load();
    else setRows([]);
    return () => { active = false; };
  }, [profile?.uid, classId]);

  if (!classId) return <section className="panel" dir="rtl">
    <h2>🏆 لوحة المتصدرين</h2>
    <p className="note">يجب ربط حسابك بصف دراسي أولًا حتى يظهر ترتيب صفك.</p>
  </section>;

  if (!rows && !error) return <section className="panel" role="status">جارٍ تحميل ترتيب الصف…</section>;

  return <section className="panel student-leaderboard" dir="rtl">
    <header className="admin-box-heading">
      <div><h2>🏆 أبطال الصف</h2><p>ترتيب أعلى 10 طلاب حسب نقاط الألعاب التعليمية في صفك.</p></div>
      <b>{total.toLocaleString("ar-EG")} طالب</b>
    </header>
    {error && <p className="err" role="alert">{error}</p>}
    {rows && rows.length === 0 && <p className="note">لا توجد نقاط مسجلة في صفك حتى الآن. ابدأ اللعب لتظهر في الترتيب.</p>}
    {rows && rows.length > 0 && <div className="arcade-students" role="list">
      {rows.map((entry, index) => <article role="listitem" key={entry.rank + "-" + entry.name + "-" + index} className={entry.isMe ? "chip" : "card"}>
        <strong>{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : "#" + entry.rank}</strong>
        <b>{entry.name}{entry.isMe ? " (أنت)" : ""}</b>
        <span>⭐ {entry.points.toLocaleString("ar-EG")} نقطة</span>
      </article>)}
      {mine && !rows.some(entry => entry.isMe) && <article className="chip">
        <strong>ترتيبك: #{mine.rank}</strong><b>{mine.name} (أنت)</b><span>⭐ {mine.points.toLocaleString("ar-EG")} نقطة</span>
      </article>}
    </div>}
    <p className="note">يظهر اسم مختصر لكل طالب، ولا يتم عرض البريد الإلكتروني أو رقم الحساب.</p>
  </section>;
}
