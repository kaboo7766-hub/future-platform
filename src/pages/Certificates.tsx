import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Role = "student" | "teacher";
type Cert = {
  id: string; recipientUid: string; recipientName: string; recipientRole: Role;
  classId?: string; title: string; reason: string; number: string; status: "pending" | "approved" | "rejected";
  createdBy: string; createdByName: string; createdAt?: any; approvedAt?: any; recipientGender?: "boy" | "girl";
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
        recipientRole: role === "admin" ? "teacher" : "student",
        ...(role === "teacher" ? {classId: target.classId} : {}),
        title: title.trim() || "شهادة تقدير", reason: reason.trim(), number: number(),
        status: role === "admin" ? "approved" : "pending",
        createdBy: profile.uid, createdByName: profile.name, createdAt: serverTimestamp(),
        ...(role === "admin" ? {approvedBy: profile.uid, approvedAt: serverTimestamp()} : {})
      });
      setMessage(role === "admin" ? "تم إصدار شهادة التقدير للمعلم." : "تم إرسال الشهادة للمدير للمراجعة. لن تظهر للطالب قبل اعتمادها.");
      setSelectedUid(""); setReason(""); setManualName(""); setGenderChoice("auto");
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
        @page { size: A4 landscape; margin: 7mm; }
        .future-cert { min-height:520px; box-sizing:border-box; padding:18px; color:#102744; background:radial-gradient(circle at 85% 12%,#fff9e9 0,#f8f1df 42%,#fff 100%); border:10px double #bd9140; font-family:Tahoma,Arial,sans-serif; }
        .future-cert-inner { min-height:470px; border:2px solid #d5b56f; padding:24px 30px; text-align:center; position:relative; }
        .future-cert-ribbon { display:inline-block; background:#102744; color:#f7d98b; padding:8px 34px; border-radius:4px; font-weight:bold; }
        .future-cert-name { display:inline-block; min-width:55%; padding:8px 28px 12px; border-bottom:3px solid #c49a49; color:#102744; font-size:34px; font-weight:900; }
        .future-cert-character { position:absolute; left:25px; bottom:35px; font-size:76px; }
        @media print { body * { visibility:hidden !important; } .certificate-print,.certificate-print * { visibility:visible !important; } .certificate-print { position:absolute; inset:0; width:100%; } .certificate-actions { display:none !important; } }
      `}</style>
      <div className="certificate-print future-cert">
        <div className="future-cert-inner">
          <div style={{fontSize:25,color:"#bd9140",fontWeight:900}}>✦ ★ ✦ ★ ✦</div>
          <div style={{fontSize:17,color:"#b08737",fontWeight:700}}>منصة المستقبل التعليمية</div>
          <div style={{position:"absolute",right:28,top:18,fontSize:38}}>🎓</div>
          <h1 style={{fontSize:42,margin:"8px 0 4px",color:"#102744"}}>شهادة تقدير</h1>
          <div className="future-cert-ribbon">بكل فخر وتقدير</div>
          <p style={{fontSize:19,margin:"18px 0 8px"}}>تُمنح هذه الشهادة إلى</p>
          <div className="future-cert-name">{view.recipientName}</div>
          <p style={{fontSize:17,lineHeight:1.9,maxWidth:760,margin:"16px auto"}}>{view.reason}</p>
          <div style={{fontSize:22,fontWeight:800,color:"#98702d",marginTop:12}}>استمر في التألق والنجاح</div>
          <div style={{fontSize:16,marginTop:5}}>مستقبلك أجمل بإذن الله ⭐</div>
          <div className="future-cert-character" aria-hidden="true">{gender === "girl" ? "👧🏻" : "👦🏻"}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",marginTop:24,fontSize:14}}>
            <span>اسم المدرسة: ........................</span><span>التاريخ: {dateText(view.approvedAt || view.createdAt)}</span><span>رقم الشهادة: {view.number}</span>
          </div>
          <div style={{fontSize:22,color:"#bd9140",marginTop:12}}>❧ ✦ ❧</div>
        </div>
      </div>
      <div className="row certificate-actions" style={{marginTop:16}}><button className="btn" onClick={() => window.print()}>تنزيل PDF / طباعة</button><button className="link" onClick={() => setView(null)}>رجوع</button></div>
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
          <label>اسم الطالب / الطالبة (يمكنك تعديله)<input value={manualName} onChange={e => setManualName(e.target.value)} maxLength={80} placeholder="اكتب اسم الطالب أو الطالبة" /></label>
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
