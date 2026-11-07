import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import Quiz, { QuizDoc } from "./Quiz";

export interface Lesson {
  id: string; title: string; description: string; classId: string; subjectId: string;
  order: number; type: string; url: string; imageData?: string; published: boolean;
}
interface Prog { lessonId: string; completed?: boolean; openedAtMs?: number }
const Bar = ({ v }: { v: number }) => <div className="bar-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${v}%` }} /></div>;

function embedUrl(url: string, type: string) {
  try {
    const u = new URL(url);
    if (type === "video" && (u.hostname === "youtu.be" || u.hostname.endsWith("youtube.com"))) {
      const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : (u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop() || "");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (u.hostname === "drive.google.com" && type === "pdf") {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
      return id ? `https://drive.google.com/file/d/${id}/preview` : url;
    }
    if (u.hostname === "vimeo.com" && type === "video") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    if (u.hostname === "player.vimeo.com" && type === "video") return url;
    if (u.hostname === "docs.google.com" && type === "pdf") return url.replace(/\/edit.*$/, "/preview");
    return "";
  } catch { return ""; }
}

export default function Lessons({ staff }: { staff: boolean }) {
  const { profile } = useAuth();
  const uid = profile!.uid, cid = profile!.classId ?? "";
  const [items, setItems] = useState<Lesson[] | null>(null);
  const [prog, setProg] = useState<Record<string, Prog>>({});
  const [quizzes, setQuizzes] = useState<QuizDoc[]>([]);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Lesson | null>(null);
  const [openQuiz, setOpenQuiz] = useState<QuizDoc | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const classIds = profile?.classIds ?? [];
    const q = profile?.role === "admin" ? collection(db, "lessons")
      : profile?.role === "teacher"
        ? (classIds.length ? query(collection(db, "lessons"), where("classId", "in", classIds.slice(0, 30))) : query(collection(db, "lessons"), where("classId", "==", "__none__")))
        : cid ? query(collection(db, "lessons"), where("published", "==", true), where("classId", "==", cid))
        : query(collection(db, "lessons"), where("published", "==", true), where("classId", "==", "__none__"));
    return onSnapshot(q, s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)).sort((a, b) => a.order - b.order)), () => setErr("تعذّر تحميل الدروس"));
  }, [staff, cid, profile?.role, profile?.classIds]);
  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "progress"), where("uid", "==", uid)), s => { const m: Record<string, Prog> = {}; s.docs.forEach(d => { const x = d.data() as Prog; m[x.lessonId] = x; }); setProg(m); });
    const classIds = profile?.classIds ?? [];
    const quizQuery = profile?.role === "admin" ? collection(db, "quizzes")
      : profile?.role === "teacher"
        ? (classIds.length ? query(collection(db, "quizzes"), where("classId", "in", classIds.slice(0, 30))) : query(collection(db, "quizzes"), where("classId", "==", "__none__")))
        : cid ? query(collection(db, "quizzes"), where("published", "==", true), where("classId", "==", cid))
        : query(collection(db, "quizzes"), where("published", "==", true), where("classId", "==", "__none__"));
    const u2 = onSnapshot(quizQuery, s => setQuizzes(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizDoc))));
    const u3 = onSnapshot(collection(db, "subjects"), s => { const m: Record<string, string> = {}; s.docs.forEach(d => { m[d.id] = d.data().name; }); setSubjects(m); });
    return () => { u1(); u2(); u3(); };
  }, [uid, profile?.role, profile?.classIds, cid]);

  const mark = async (l: Lesson, patch: Partial<Prog>) => {
    await setDoc(doc(db, "progress", `${uid}_${l.id}`), { uid, lessonId: l.id, subjectId: l.subjectId, ...patch, updatedAt: serverTimestamp() }, { merge: true });
  };
  const recordAttendance = async (l: Lesson) => {
    const user = auth.currentUser;
    if (!user || !profile || !["student", "teacher", "admin"].includes(profile.role)) return;
    const now = new Date(), dateKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const attendanceId = `${uid}_${l.id}_${dateKey}`;
    const ref = doc(db, "attendance", attendanceId);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid, userName: profile.name, role: profile.role, lessonId: l.id,
        lessonTitle: l.title, classId: profile.classId ?? "", subjectId: l.subjectId,
        dateKey, enteredAt: serverTimestamp()
      });
    }
  };
  const openLesson = async (l: Lesson) => {
    setErr("");
    try {
      await recordAttendance(l);
      if (profile?.role === "student") await mark(l, { openedAtMs: Date.now() });
      setOpen(l);
    } catch {
      setErr("تعذّر تسجيل الحضور أو فتح الدرس. تأكد من اتصال الإنترنت وصلاحيات الحساب.");
    }
  };

  const stats = useMemo(() => {
    const pub = (items ?? []).filter(l => l.published);
    const done = pub.filter(l => prog[l.id]?.completed);
    const bySubject = Object.entries(pub.reduce<Record<string, Lesson[]>>((a, l) => ((a[l.subjectId] ??= []).push(l), a), {}))
      .map(([id, ls]: [string, Lesson[]]) => ({ name: subjects[id] ?? "مادة", pct: Math.round(100 * ls.filter(l => prog[l.id]?.completed).length / ls.length) }));
    const last = pub.filter(l => !prog[l.id]?.completed && prog[l.id]?.openedAtMs).sort((a, b) => prog[b.id].openedAtMs! - prog[a.id].openedAtMs!)[0];
    return { pct: pub.length ? Math.round(100 * done.length / pub.length) : 0, bySubject, last };
  }, [items, prog, subjects]);

  if (err) return <p className="err" role="alert">{err}</p>;
  if (!items) return <p>جارٍ تحميل الدروس…</p>;
  if (openQuiz) return <Quiz quiz={openQuiz} onClose={() => setOpenQuiz(null)} />;
  if (open) {
    const embed = embedUrl(open.url, open.type);
    const qz = quizzes.find(q => q.lessonId === open.id);
    return <section className="panel lesson-viewer">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>{open.title}</h2><button className="link" onClick={() => setOpen(null)}>إغلاق ✕</button>
      </div>
      {open.description && <p>{open.description}</p>}
      {open.type === "image" && (open.imageData || open.url)
        ? <img src={open.imageData || open.url} alt={open.title} style={{ display: "block", maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", margin: "1rem auto", borderRadius: 14 }} />
        : open.type === "audio" && open.url
          ? <audio controls src={open.url} style={{ width: "100%" }} />
          : embed
            ? <div style={{ position: "relative", paddingTop: "56.25%", overflow: "hidden", borderRadius: 14, background: "#111" }}>
                <iframe src={embed} title={open.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
              </div>
            : open.url
              ? <p><a className="btn" href={open.url} target="_blank" rel="noopener noreferrer">افتح محتوى الدرس في نافذة جديدة</a></p>
              : <p className="note">أضف محتوى لهذا الدرس من لوحة الإدارة.</p>}
      <div className="row" style={{ flexWrap: "wrap", marginTop: "1rem" }}>
        {!staff && <button className="btn" onClick={() => mark(open, { completed: true }).then(() => setOpen(null)).catch(() => setErr("تعذّر حفظ إكمال الدرس"))}>تم إكمال الدرس ✓</button>}
        {!staff && qz && <button className="btn" onClick={() => setOpenQuiz(qz)}>ابدأ الاختبار التفاعلي ✍️</button>}
      </div>
    </section>;
  }
  if (!items.length) return <p className="note">لا توجد دروس منشورة بعد.</p>;
  return (<>
    {!staff && <section className="panel"><h3>تقدّمك: {stats.pct}%</h3><Bar v={stats.pct} />
      {stats.bySubject.map(s => <div key={s.name}><small>{s.name} — {s.pct}%</small><Bar v={s.pct} /></div>)}
      {stats.last && <button className="btn" onClick={() => void openLesson(stats.last!)}>أكمل من حيث توقفت: {stats.last.title}</button>}
    </section>}
    <h3>الدروس</h3>
    <div className="grid">{items.map((l, i) => {
      const qz = quizzes.find(q => q.lessonId === l.id), done = prog[l.id]?.completed;
      return <div key={l.id} className={`card c${i % 4}`}>
        {l.imageData && <img src={l.imageData} alt="" loading="lazy" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 10 }} />}
        <b>{done && "✅ "}{l.title}</b><small>{l.description}</small>{!l.published && <em>مسودة</em>}
        <button className="mini" onClick={() => void openLesson(l)}>ابدأ الدرس</button>
        {!staff && !done && <button className="mini" onClick={() => mark(l, { completed: true }).catch(() => setErr("تعذّر حفظ التقدم"))}>تم الإكمال</button>}
        {!staff && qz && <button className="mini" onClick={() => setOpenQuiz(qz)}>الاختبار</button>}
      </div>;
    })}</div>
  </>);
}
