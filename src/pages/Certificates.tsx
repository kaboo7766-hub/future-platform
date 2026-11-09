import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Role = "student" | "teacher";
type Cert = {
  id: string; recipientUid: string; recipientName: string; recipientRole: Role;
  classId?: string; title: string; reason: string; number: string; status: "pending" | "approved" | "rejected";
  createdBy: string; createdByName: string; createdAt?: any; approvedAt?: any; recipientGender?: "boy" | "girl"; schoolName?: string;
};
const detectGender = (name: string): "boy" | "girl" => {
  const n = name.trim().replace(/[ًٌٍَُِّْـ]/g, "");
  return (/ة$|اء$|ى$/.test(n) || /^(نور|إيمان|آية|هدى|منى|سما|جنى|ملك|مريم|فاطمة|عائشة|زينب|سلمى|ليلى|رنا|دينا|هنا|هبة|رحمة|بسملة|شهد|فرح|مي|يارا|لارا|تاليا|حبيبة|جوري|روان|رؤى|سارة|ياسمين|أميرة|أسماء|دعاء|صفاء|وفاء|نهى|ضحى|شيماء|رقية|لينا|مها|سندس|حنين)$/i.test(n)) ? "girl" : "boy";
};
type Person = { uid: string; name?: string; email?: string; role: string; classId?: string };
type SchoolClass = { id: string; name: string };
const number = () => "FUT-" + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(x => x.toString(16).padStart(2,"0")).join("").toUpperCase();
const dateText = (value: any) => {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : new Date());
  return date.toLocaleDateString("ar-EG");
};

export default function Certificates() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [people, setPeople] = useState<Person[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [teacherAwards, setTeacherAwards] = useState<Cert[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [title, setTitle] = useState("شهادة تقدير");
  const [reason, setReason] = useState("");
  const [manualName, setManualName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [genderChoice, setGenderChoice] = useState<"auto" | "boy" | "girl">("auto");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<Cert | null>(null);
  const classIds = profile?.classIds ?? [];

  useEffect(() => {
    if (!profile) return;
    const stops: (() => void)[] = [];
    if (role === "admin") {
      stops.push(onSnapshot(collection(db, "users"), s => setPeople(s.docs.map(d => d.data() as Person)), e => setMessage("تعذر تحميل المستخدمين: " + e.message)));
      stops.push(onSnapshot(collection(db, "classes"), s => setClasses(s.docs.map(d => ({id:d.id,name:String(d.data().name || "صف")})))));
      stops.push(onSnapshot(collection(db, "certificates"), s => setCerts(s.docs.map(d => ({id:d.id,...d.data()} as Cert))), e => setMessage("تعذر تحميل الشهادات: " + e.message)));
    } else if (role === "teacher") {
      stops.push(onSnapshot(query(collection(db, "certificates"), where("createdBy", "==", profile.uid)), s => setCerts(s.docs.map(d => ({id:d.id,...d.data()} as Cert))), e => setMessage("تعذر تحميل طلبات الشهادات: " + e.message)));
      stops.push(onSnapshot(query(collection(db, "certificates"), where("recipientUid", "==", profile.uid), where("status", "==", "approved")), s => setTeacherAwards(s.docs.map(d => ({id:d.id,...d.data()} as Cert))), e => setMessage("تعذر تحميل شهادتك: " + e.message)));
      classIds.forEach(classId => stops.push(onSnapshot(query(collection(db, "users"), where("classId", "==", classId)), s => {
        setPeople(old => [...old.filter(p => p.classId !== classId), ...s.docs.map(d => d.data() as Person).filter(p => p.role === "student")]);
      }, e => setMessage("تعذر تحميل طلاب الصف: " + e.message))));
      stops.push(onSnapshot(collection(db, "classes"), s => setClasses(s.docs.map(d => ({id:d.id,name:String(d.data().name || "صف")})))));
    } else if (role === "student") {
      stops.push(onSnapshot(query(collection(db, "certificates"), where("recipientUid", "==", profile.uid), where("status", "==", "approved")), s => setCerts(s.docs.map(d => ({id:d.id,...d.data()} as Cert))), e => setMessage("تعذر تحميل شهاداتك: " + e.message)));
    }
    return () => stops.forEach(stop => stop());
  }, [profile?.uid, role, classIds.join("|")]);

  const visibleStudents = useMemo(() => people.filter(p => p.role === "student" && classIds.includes(p.classId || "")), [people, classIds.join("|")]);
  const teachers = useMemo(() => people.filter(p => p.role === "teacher"), [people]);
  const pending = certs.filter(c => c.status === "pending" && c.recipientRole === "student");
  const displayCerts = role === "teacher" ? [...certs, ...teacherAwards.filter(a => !certs.some(c => c.id === a.id))] : certs;
  const makeCertificate = async () => {
    if (!profile || !selectedUid || !reason.trim()) { setMessage("اختر الشخص واكتب سبب التكريم أولًا."); return; }
    const target = role === "admin" ? teachers.find(p => p.uid === selectedUid) : visibleStudents.find(p => p.uid === selectedUid);
    if (!target) { setMessage("الشخص المحدد غير متاح."); return; }
    setBusy("create"); setMessage("");
    try {
      await addDoc(collection(db, "certificates"), {
        recipientUid: target.uid, recipientName: manualName.trim() || target.name || target.email || "بدون اسم",
        recipientGender: genderChoice === "auto" ? detectGender(manualName.trim() || target.name || "") : genderChoice,
        schoolName: schoolName.trim(),
        recipientRole: role === "admin" ? "teacher" : "student",
        ...(role === "teacher" ? {classId: target.classId} : {}),
        title: title.trim() || "شهادة تقدير", reason: reason.trim(), number: number(),
        status: role === "admin" ? "approved" : "pending",
        createdBy: profile.uid, createdByName: profile.name, createdAt: serverTimestamp(),
        ...(role === "admin" ? {approvedBy: profile.uid, approvedAt: serverTimestamp()} : {})
      });
      setMessage(role === "admin" ? "تم إصدار شهادة التقدير للمعلم." : "تم إرسال الشهادة للمدير للمراجعة. لن تظهر للطالب قبل اعتمادها.");
      setSelectedUid(""); setReason(""); setManualName(""); setSchoolName(""); setGenderChoice("auto");
    } catch (e: any) { setMessage("لم يتم حفظ الشهادة: " + (e?.message || "تحقق من صلاحيات Firestore.")); }
    finally { setBusy(""); }
  };
  const review = async (cert: Cert, status: "approved" | "rejected") => {
    if (!profile) return;
    setBusy(cert.id); setMessage("");
    try {
      await updateDoc(doc(db, "certificates", cert.id), {status, approvedBy: profile.uid, approvedAt: serverTimestamp()});
      setMessage(status === "approved" ? "تم اعتماد الشهادة وستظهر للطالب الآن." : "تم رفض الشهادة، ولن تظهر للطالب.");
    } catch (e: any) { setMessage("تعذر تحديث الشهادة: " + (e?.message || "تحقق من قواعد Firestore.")); }
    finally { setBusy(""); }
  };

  if (!profile) return null;
  if (view) {
    const gender = view.recipientGender || detectGender(view.recipientName);
    return <section dir="rtl">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        .future-cert { width:100%; min-height:265mm; box-sizing:border-box; padding:13px; color:#10233f; background:radial-gradient(circle at 50% 15%,#fffdf6 0,#f6edda 58%,#fffaf0 100%); border:8px double #b78a37; font-family:Tahoma,Arial,sans-serif; position:relative; overflow:hidden; }
        .future-cert:before,.future-cert:after { content:"✦ ❖ ✦ ❖ ✦"; position:absolute; color:#bd9348; letter-spacing:9px; font-size:18px; left:0; right:0; text-align:center; }
        .future-cert:before{top:8px}.future-cert:after{bottom:8px}
        .future-cert-inner { min-height:237mm; border:2px solid #d5b56f; outline:1px solid #d5b56f; outline-offset:5px; padding:22px 24px; text-align:center; position:relative; display:flex; flex-direction:column; align-items:center; }
        .future-cert-brand{font-size:20px;font-weight:900;color:#b18432;letter-spacing:.3px;margin-top:7px}
        .future-cert-title{font-size:clamp(34px,6vw,48px);line-height:1.3;margin:18px 0 8px;color:#102744;text-shadow:1px 2px 0 #e8d29a}
        .future-cert-ribbon { display:inline-block; background:linear-gradient(90deg,#09182d,#18395d,#09182d); color:#f8df9e; padding:9px 38px; border:2px solid #c39a4d; border-radius:5px; font-weight:bold; box-shadow:0 4px 0 #d8bd83; }
        .future-cert-award{font-size:20px;margin:25px 0 10px;color:#28364b}
        .future-cert-name { display:block; width:85%; padding:12px 16px 14px; border:2px solid #bd9140; border-radius:40px; background:#fffdf8; color:#102744; font-size:clamp(25px,5vw,36px); font-weight:900; box-shadow:inset 0 0 0 4px #f4e8c9,0 4px 12px #76551b20; }
        .future-cert-reason{font-size:17px;line-height:2;max-width:650px;margin:20px auto;color:#263448}
        .future-cert-wish{font-size:24px;font-weight:900;color:#98702d;margin:12px 0 3px}
        .future-cert-sub{font-size:17px;color:#263448;margin:0 0 18px}
        .future-cert-character{font-size:86px;line-height:1.2;margin:4px auto 12px;filter:drop-shadow(0 5px 3px #0002)}
        .future-cert-meta{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:auto;padding-top:18px;border-top:1px solid #c8aa70;color:#24334a;font-size:14px}
        .future-cert-meta b{display:block;color:#9b742e;margin-bottom:4px}
        .future-cert-seal{position:absolute;bottom:14px;left:16px;border:4px double #bd9140;border-radius:50%;width:76px;height:76px;display:grid;place-items:center;background:#102744;color:#f8df9e;font-size:12px;font-weight:900;transform:rotate(-12deg)}
        .certificate-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
        @media print { html,body{background:#fff!important}.certificate-print,.certificate-print * { visibility:visible !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; } body * { visibility:hidden !important; } .certificate-print { position:absolute; inset:0; width:100%; margin:0; } .certificate-actions { display:none !important; } }
        @media(max-width:520px){.future-cert{min-height:600px;padding:8px}.future-cert-inner{min-height:570px;padding:18px 10px}.future-cert-meta{font-size:11px;gap:3px}.future-cert-character{font-size:70px}.future-cert-seal{width:60px;height:60px;font-size:10px}}
      `}</style>
      <div className="certificate-print future-cert">
        <div className="future-cert-inner">
          <div style={{fontSize:28,color:"#bd9140",fontWeight:900}}>✦ ★ ✦ ★ ✦</div>
          <div className="future-cert-brand">منصة المستقبل التعليمية</div>
          <div className="future-cert-character" aria-hidden="true">{gender === "girl" ? "👩🏻‍🎓" : "👨🏻‍🎓"}</div>
          <h1 className="future-cert-title">شهادة تكريم</h1>
          <div className="future-cert-ribbon">بكل فخر وتقدير</div>
          <p className="future-cert-award">تُمنح هذه الشهادة إلى</p>
          <div className="future-cert-name">{view.recipientName}</div>
          <p className="future-cert-reason">{view.reason}</p>
          <div className="future-cert-wish">استمر في التألق والنجاح</div>
          <p className="future-cert-sub">مستقبلك أجمل بإذن الله ⭐</p>
          <div className="future-cert-seal">مستقبل<br/>مشرق<br/>ينتظرك</div>
          <div className="future-cert-meta">
            <span><b>اسم المدرسة</b>{view.schoolName || "........................"}</span>
            <span><b>المعلم / المعلمة</b>{view.createdByName || "........................"}</span>
            <span><b>التاريخ</b>{dateText(view.approvedAt || view.createdAt)}</span>
          </div>
          <div style={{fontSize:20,color:"#bd9140",marginTop:15}}>❧ ✦ ❧</div>
          <small style={{color:"#98702d",fontWeight:800}}>رقم الشهادة: {view.number}</small>
        </div>
      </div>
      <div className="row certificate-actions"><button className="btn" onClick={() => window.print()}>تنزيل PDF / طباعة</button><button className="link" onClick={() => setView(null)}>رجوع</button></div>
    </section>;
  }

  return <section className="panel" dir="rtl">
    <div className="admin-box-heading"><div><h3>🏆 الشهادات والتكريم</h3><p>شهادات شخصية باسم منصة المستقبل التعليمية</p></div></div>
    {(role === "admin" || role === "teacher") && <section className="admin-box">
      <h3>{role === "admin" ? "منح شهادة تقدير لمعلم" : "إنشاء شهادة تقدير لطالب"}</h3>
      <div className="form-grid">
        <label>اختر {role === "admin" ? "المعلم" : "الطالب"}
          <select value={selectedUid} onChange={e => setSelectedUid(e.target.value)}><option value="">اختر الاسم</option>
            {(role === "admin" ? teachers : visibleStudents).map(p => <option key={p.uid} value={p.uid}>{p.name || p.email || p.uid}{role === "teacher" ? " — " + (classes.find(c => c.id === p.classId)?.name || "صفه") : ""}</option>)}
          </select>
        </label>
        <label>عنوان الشهادة<input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></label>
        {role === "teacher" && <>
          <label>اسم الطالب / الطالبة (اكتب الاسم كما تريد ظهوره)<input value={manualName} onChange={e => setManualName(e.target.value)} maxLength={80} placeholder="اكتب اسم الطالب أو الطالبة" /></label>
          <label>اسم المدرسة<input value={schoolName} onChange={e => setSchoolName(e.target.value)} maxLength={100} placeholder="اكتب اسم المدرسة" /></label>
          <label>شكل شخصية الشهادة<select value={genderChoice} onChange={e => setGenderChoice(e.target.value as "auto" | "boy" | "girl")}><option value="auto">تلقائي حسب الاسم</option><option value="boy">ولد 👦</option><option value="girl">بنت 👧</option></select></label>
        </>}
        <label style={{gridColumn:"1 / -1"}}>سبب التكريم<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} placeholder="مثال: التفوق الدراسي والالتزام والمشاركة المتميزة" /></label>
      </div>
      <button className="btn" disabled={!!busy} onClick={() => void makeCertificate()}>{busy === "create" ? "جارٍ الحفظ…" : role === "admin" ? "إصدار شهادة للمعلم" : "إرسال الشهادة لاعتماد المدير"}</button>
      {role === "teacher" && <p className="note">الشهادة تظل قيد المراجعة ولا تظهر للطالب إلا بعد موافقة المدير.</p>}
    </section>}
    {role === "admin" && <section className="admin-box"><h3>طلبات شهادات الطلاب ({pending.length})</h3>
      {pending.length === 0 ? <p className="note">لا توجد شهادات تنتظر الموافقة.</p> : pending.map(c => <article key={c.id} className="admin-box">
        <b>{c.recipientName}</b><p>{c.title} — {c.reason}</p><small>مقدم الطلب: {c.createdByName} · {dateText(c.createdAt)}</small>
        <div className="row"><button className="btn" disabled={!!busy} onClick={() => void review(c,"approved")}>موافقة وإظهار للطالب</button><button className="mini" disabled={!!busy} onClick={() => void review(c,"rejected")}>رفض</button></div>
      </article>)}
    </section>}
    <section className="admin-box"><h3>{role === "student" ? "شهاداتي المعتمدة" : role === "teacher" ? "شهاداتي وطلبات الطلاب" : "الشهادات الصادرة"}</h3>
      {displayCerts.filter(c => c.status === "approved" || (role === "teacher" && c.createdBy === profile.uid && c.status === "pending")).length === 0
        ? <p className="note">لا توجد شهادات حتى الآن.</p>
        : displayCerts.filter(c => c.status === "approved" || (role === "teacher" && c.createdBy === profile.uid && c.status === "pending")).map(c => <div className="row" key={c.id} style={{justifyContent:"space-between",flexWrap:"wrap"}}>
          <span><b>{c.recipientName}</b> — {c.title}<small style={{display:"block"}}>{c.status === "pending" ? "قيد اعتماد المدير" : "معتمدة"} · {c.number}</small></span>
          {c.status === "approved" && <button className="mini" onClick={() => setView(c)}>عرض / PDF / طباعة</button>}
        </div>)}
    </section>
    {message && <p className={message.startsWith("لم") || message.startsWith("تعذر") ? "err" : "ok"} role="status">{message}</p>}
  </section>;
}
