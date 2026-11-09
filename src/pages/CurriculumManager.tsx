import { useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";

type Grade = { gradeId: string; name: string; stage: string; order: number };
type Subject = { subjectId: string; gradeId: string; subjectCode: string; name: string; category: string; order: number };
type Lesson = { lessonId: string; order: number; title: string; microGoal: string };
type Unit = { unitId: string; subjectId: string; gradeId: string; order: number; title: string; lessons: Lesson[]; checkpoint: Record<string, unknown>; unitQuiz: Record<string, unknown> };
type Curriculum = { schemaVersion: string; gradeCatalog: Grade[]; subjectCatalog: Subject[]; units: Unit[]; lessonFlow: Array<Record<string, unknown>> };
type SourceGrade = { gradeId: string; gradeName: string; officialBookCount: number; catalogUrl: string; availability: string; subjects: string[]; note: string };
type SourceCatalog = { schoolYear: string; officialPortal: string; checkedAt: string; grades: SourceGrade[] };

type ImportRecord = { id: string; data: Record<string, unknown> };
const COLLECTIONS = ["curriculumGrades", "curriculumSubjects", "curriculumUnits", "curriculumLessons", "curriculumAssessments"] as const;

function buildImportRecords(map: Curriculum): Array<{ collection: typeof COLLECTIONS[number]; records: ImportRecord[] }> {
  const grouped: Record<string, ImportRecord[]> = Object.fromEntries(COLLECTIONS.map(name => [name, []]));
  for (const grade of map.gradeCatalog) grouped.curriculumGrades.push({ id: grade.gradeId, data: { ...grade, published: false } });
  for (const subject of map.subjectCatalog) grouped.curriculumSubjects.push({ id: subject.subjectId, data: { ...subject, published: false } });

  for (const unit of map.units) {
    const { lessons, checkpoint, unitQuiz, ...unitData } = unit;
    grouped.curriculumUnits.push({
      id: unit.unitId,
      data: {
        ...unitData,
        lessonIds: lessons.map(lesson => lesson.lessonId),
        checkpointAssessmentId: checkpoint.assessmentId,
        unitQuizAssessmentId: unitQuiz.assessmentId,
        published: false,
      },
    });
    for (const lesson of lessons) {
      grouped.curriculumLessons.push({
        id: lesson.lessonId,
        data: {
          ...lesson,
          unitId: unit.unitId,
          subjectId: unit.subjectId,
          gradeId: unit.gradeId,
          flow: map.lessonFlow,
          unlockRule: lesson.order === 1 ? "unit_opened" : "previous_lesson_passed",
          passPercent: 60,
          published: false,
        },
      });
    }
    grouped.curriculumAssessments.push({
      id: String(checkpoint.assessmentId),
      data: { ...checkpoint, unitId: unit.unitId, subjectId: unit.subjectId, gradeId: unit.gradeId, published: false },
    });
    grouped.curriculumAssessments.push({
      id: String(unitQuiz.assessmentId),
      data: { ...unitQuiz, unitId: unit.unitId, subjectId: unit.subjectId, gradeId: unit.gradeId, published: false },
    });
  }
  return COLLECTIONS.map(collection => ({ collection, records: grouped[collection] }));
}

export default function CurriculumManager() {
  const [map, setMap] = useState<Curriculum | null>(null);
  const [sourceCatalog, setSourceCatalog] = useState<SourceCatalog | null>(null);
  const [gradeId, setGradeId] = useState("kg1");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/curriculum-map.json", { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("تعذّر تحميل ملف خريطة المنهج.");
        return response.json() as Promise<Curriculum>;
      }),
      fetch("/primary-curriculum-sources-2026-2027.json", { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("تعذّر تحميل فهرس مصادر الكتب الرسمية.");
        return response.json() as Promise<SourceCatalog>;
      }),
    ])
      .then(([data, sources]) => {
        if (!data.gradeCatalog || !data.subjectCatalog || !data.units || !data.lessonFlow) {
          throw new Error("ملف المنهج لا يحتوي على البنية المطلوبة.");
        }
        if (!active) return;
        setMap(data);
        setSourceCatalog(sources);
        const firstPrimary = data.gradeCatalog.find(grade => grade.gradeId === "g1") ?? data.gradeCatalog[0];
        setGradeId(firstPrimary?.gradeId ?? "");
        setSubjectId(data.subjectCatalog.find(s => s.gradeId === firstPrimary?.gradeId)?.subjectId ?? "");
      })
      .catch(error => { if (active) setMessage({ ok: false, text: error instanceof Error ? error.message : "تعذّر تحميل المنهج." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const grades = map?.gradeCatalog ?? [];
  const subjects = useMemo(() => (map?.subjectCatalog ?? []).filter(item => item.gradeId === gradeId), [map, gradeId]);
  const units = useMemo(() => (map?.units ?? []).filter(item => item.gradeId === gradeId && item.subjectId === subjectId), [map, gradeId, subjectId]);
  const subject = subjects.find(item => item.subjectId === subjectId);
  const totalLessons = units.reduce((sum, unit) => sum + unit.lessons.length, 0);

  const importCurriculum = async () => {
    if (!map || busy) return;
    const user = auth.currentUser;
    if (!user) {
      setMessage({ ok: false, text: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." });
      return;
    }
    if (!window.confirm("سيتم استيراد خريطة الصفوف والمواد والوحدات والدروس والمراجعات والاختبارات إلى Firestore كمسودات غير منشورة. لن يظهر المحتوى للطلاب الآن. هل تريد المتابعة؟")) return;

    setBusy(true);
    setMessage(null);
    try {
      const token = await user.getIdToken();
      const groups = buildImportRecords(map);
      const allBatches = groups.flatMap(group => {
        const batches: ImportRecord[][] = [];
        for (let index = 0; index < group.records.length; index += 50) batches.push(group.records.slice(index, index + 50));
        return batches.map(records => ({ collection: group.collection, records }));
      });
      setProgress({ done: 0, total: allBatches.length, label: "بدء الاستيراد" });
      let imported = 0;
      for (let index = 0; index < allBatches.length; index++) {
        const batch = allBatches[index];
        setProgress({ done: index, total: allBatches.length, label: batch.collection });
        const response = await fetch("/api/admin/import-curriculum", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(batch),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذّر استيراد المنهج.");
        imported += Number(result.imported || 0);
        setProgress({ done: index + 1, total: allBatches.length, label: batch.collection });
      }
      setMessage({ ok: true, text: `اكتمل الاستيراد: ${imported.toLocaleString("ar-EG")} سجلًا. جميع العناصر محفوظة كمسودات غير منشورة.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "توقف الاستيراد. أعد المحاولة؛ السجلات السابقة يمكن تحديثها بأمان." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="panel"><p>جارٍ تحميل خريطة المناهج…</p></section>;

  return <section className="curriculum-manager" dir="rtl">
    <header className="curriculum-heading">
      <div><span className="curriculum-kicker">إدارة المحتوى الأكاديمي</span><h2>خريطة المناهج والمسارات التعليمية</h2>
        <p>استعرض المراحل والمواد والوحدات، ثم استورد الهيكل إلى قاعدة البيانات كمسودات آمنة.</p></div>
      <span className="curriculum-icon" aria-hidden="true">🗺️</span>
    </header>

    {message && <p className={message.ok ? "ok curriculum-message" : "err curriculum-message"} role="status">{message.text}</p>}

    <div className="curriculum-summary">
      <article><b>{grades.length}</b><span>مرحلة وصف</span></article>
      <article><b>{map?.subjectCatalog.length ?? 0}</b><span>سجل مادة</span></article>
      <article><b>{map?.units.length ?? 0}</b><span>وحدة</span></article>
      <article><b>{map?.units.reduce((sum, unit) => sum + unit.lessons.length, 0) ?? 0}</b><span>درس</span></article>
    </div>

    <section className="panel curriculum-controls">
      <label>اختر الصف الدراسي
        <select value={gradeId} onChange={event => {
          const nextGrade = event.target.value;
          setGradeId(nextGrade);
          setSubjectId(map?.subjectCatalog.find(item => item.gradeId === nextGrade)?.subjectId ?? "");
        }}>
          {grades.map(grade => <option key={grade.gradeId} value={grade.gradeId}>{grade.name}</option>)}
        </select>
      </label>
      <label>اختر المادة
        <select value={subjectId} onChange={event => setSubjectId(event.target.value)}>
          {subjects.map(item => <option key={item.subjectId} value={item.subjectId}>{item.name} {item.category === "enrichment" ? "— إثرائي" : ""}</option>)}
        </select>
      </label>
      <div className="curriculum-selection">
        <b>{subject?.name ?? "اختر مادة"}</b>
        <span>{units.length} وحدات · {totalLessons} دروس قصيرة</span>
      </div>
    </section>

    <div className="curriculum-units">
      {units.map(unit => <article className="panel curriculum-unit" key={unit.unitId}>
        <div className="curriculum-unit-title"><span>الوحدة {unit.order}</span><h3>{unit.title}</h3></div>
        <ol>{unit.lessons.map(lesson => <li key={lesson.lessonId}>
          <b>{lesson.title}</b><small>{lesson.microGoal}</small>
        </li>)}</ol>
        <div className="curriculum-assessments">
          <span>🔁 {String(unit.checkpoint.title ?? "مراجعة الوحدة")}</span>
          <span>🏅 {String(unit.unitQuiz.title ?? "اختبار الوحدة")} — نجاح {String(unit.unitQuiz.passPercent ?? 70)}%</span>
        </div>
      </article>)}
      {!units.length && <p className="note">لا توجد وحدات لهذه المادة في هذا الصف.</p>}
    </div>

    {sourceCatalog && (() => {
      const source = sourceCatalog.grades.find(item => item.gradeId === gradeId);
      if (!source) return null;
      return <section className="panel curriculum-source-panel">
        <div><h3>مصادر الكتب الرسمية للعام {sourceCatalog.schoolYear}</h3>
          <p>{source.gradeName}: {source.officialBookCount} كتابًا مدرسيًا مسجلًا في فهرس الترم الأول. تاريخ مراجعة الفهرس: {sourceCatalog.checkedAt}.</p>
          <p><b>المواد:</b> {source.subjects.join("، ")}</p>
          <p className="note">تنبيه: روابط الفهرس تفتح الكتب من خوادم الوزارة. فهرس الوحدات والدروس التفصيلي والامتحانات المرتبطة بها لا يُعتمد إلا بعد مراجعة ملف كل كتاب.</p>
        </div>
        <div className="curriculum-source-links">
          <a className="btn" href={source.catalogUrl} target="_blank" rel="noreferrer">فتح كتب الصف في الفهرس</a>
          <a href={sourceCatalog.officialPortal} target="_blank" rel="noreferrer">المكتبة الإلكترونية الرسمية للوزارة</a>
        </div>
      </section>;
    })()}

    <section className="panel curriculum-import">
      <div><h3>استيراد المنهج إلى قاعدة البيانات</h3>
        <p>يتم تقسيم البيانات إلى دفعات صغيرة، مع التحقق من صلاحية المدير. لن يتم نشر أي درس أو اختبار تلقائيًا.</p></div>
      <button className="btn" type="button" onClick={importCurriculum} disabled={busy || !map}>
        {busy ? "جارٍ استيراد المنهج…" : "استيراد جميع الصفوف والمواد"}
      </button>
      {busy && <div className="curriculum-progress" role="status">
        <div><span>{progress.label}</span><b>{progress.done} / {progress.total}</b></div>
        <progress value={progress.done} max={Math.max(1, progress.total)} />
      </div>}
    </section>
  </section>;
}
