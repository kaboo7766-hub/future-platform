import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import type { Question } from "./Quiz";
const blank = (): Question => ({ type: "mcq", text: "", options: ["", "", "", ""], answer: 0 });

export default function QuizBuilder() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [lessonId, setLessonId] = useState(""), [title, setTitle] = useState("");
  const [allowRetake, setRetake] = useState(true), [published, setPub] = useState(false);
  const [qs, setQs] = useState<Question[]>([blank()]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(collection(db, "lessons"), s => setLessons(s.docs.map(d => ({ id: d.id, title: d.data().title })))), []);
  const upd = (i: number, p: Partial<Question>) => setQs(a => a.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const setType = (i: number, type: "mcq" | "tf") => upd(i, type === "tf" ? { type, options: ["صح", "خطأ"], answer: 0 } : { type, options: ["", "", "", ""], answer: 0 });
  const save = async () => {
    setMsg(null);
    const bad = qs.some(q => !q.text.trim() || q.options.some(o => !o.trim()) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length);
    if (!lessonId || !title.trim() || bad) return setMsg({ ok: false, t: "أكمل الدرس والعنوان ونص كل سؤال وخياراته وحدد الإجابة الصحيحة" });
    setBusy(true);
    try {
      const quizRef = doc(collection(db, "quizzes"));
      const batch = writeBatch(db);
      batch.set(quizRef, {
        lessonId, title: title.trim(),
        questions: qs.map(({ answer: _answer, ...question }) => question),
        allowRetake, published, createdBy: profile!.uid, createdAt: serverTimestamp()
      });
      batch.set(doc(db, "quizAnswerKeys", quizRef.id), {
        quizId: quizRef.id, answers: qs.map(q => q.answer), createdBy: profile!.uid, createdAt: serverTimestamp()
      });
      await batch.commit();
      setMsg({ ok: true, t: "تم حفظ الاختبار ومفتاح الإجابات بشكل آمن" }); setQs([blank()]); setTitle("");
    } catch { setMsg({ ok: false, t: "تعذّر الحفظ، تحقق من صلاحيات المدير أو المعلم" }); }
    finally { setBusy(false); }
  };
  return (<section className="panel"><h3>إنشاء اختبار</h3>
    <select value={lessonId} onChange={e => setLessonId(e.target.value)}><option value="">اختر الدرس</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
    <input placeholder="عنوان الاختبار" value={title} onChange={e => setTitle(e.target.value)} />
    {qs.map((q, i) => (<fieldset key={i} className="q"><legend>سؤال {i + 1}</legend>
      <select value={q.type} onChange={e => setType(i, e.target.value as "mcq" | "tf")}><option value="mcq">اختيار من متعدد</option><option value="tf">صح أو خطأ</option></select>
      <input placeholder="نص السؤال" value={q.text} onChange={e => upd(i, { text: e.target.value })} />
      {q.options.map((o, j) => (<label key={j}><input type="radio" name={`a${i}`} checked={q.answer === j} onChange={() => upd(i, { answer: j })} />
        {q.type === "tf" ? o : <input placeholder={`الخيار ${j + 1}`} value={o} onChange={e => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />}</label>))}
      <small>حدّد الدائرة بجوار الإجابة الصحيحة</small>
      {qs.length > 1 && <button type="button" className="link" onClick={() => setQs(a => a.filter((_, k) => k !== i))}>حذف السؤال</button>}
    </fieldset>))}
    <button type="button" className="link" onClick={() => setQs(a => [...a, blank()])}>+ إضافة سؤال</button>
    <label><input type="checkbox" checked={allowRetake} onChange={e => setRetake(e.target.checked)} /> السماح بإعادة الاختبار</label>
    <label><input type="checkbox" checked={published} onChange={e => setPub(e.target.checked)} /> نشر الاختبار</label>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
    <button className="btn" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الاختبار"}</button>
  </section>);
}
