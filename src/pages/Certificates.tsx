import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Role = "student" | "teacher";
type Cert = {
  id: string; recipientUid: string; recipientName: string; recipientRole: Role;
  classId?: string; title: string; reason: string; number: string; status: "pending" | "approved" | "rejected";
  createdBy: string; createdByName: string; createdAt?: any; approvedAt?: any;
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
  const [selectedUid, setSelectedUid] = useState("");
  const [title, setTitle] = useState("شهادة تقدير");
  const [reason, setReason] = useState("");
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
      stops.push(onSnapshot(query(collection(db, "certificates"), where("recipientUid", "==", profile.uid), where("status", "==", "approved")), s => setCerts(old => {
        const own = s.docs.map(d => ({id:d.id,...d.data()} as Cert));
        const authored = old.filter(c => c.createdBy === profile.uid);
        return [...authored, ...own.filter(c => !authored.some(a => a.id === c.id))];
      }), e => setMessage("تعذر تحميل شهادتك: " + e.message)));
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
  const makeCertificate = async () => {
    if (!profile || !selectedUid || !reason.trim()) { setMessage("اختر الشخص واكتب سبب التكريم أولًا."); return; }
    const target = role === "admin" ? teachers.find(p => p.uid === selectedUid) : visibleStudents.find(p => p.uid === selectedUid);
    if (!target) { setMessage("الشخص المحدد غير متاح."); return; }
    setBusy("create"); setMessage("");
    try {
      await addDoc(collection(db, "certificates"), {
        recipientUid: target.uid, recipientName: target.name || target.email || "بدون اسم",
        recipientRole: role === "admin" ? "teacher" : "student",
        ...(role === "teacher" ? {classId: target.classId} : {}),
        title: title.trim() || "شهادة تقدير", reason: reason.trim(), number: number(),
        status: role === "admin" ? "approved" : "pending",
        createdBy: profile.uid, createdByName: profile.name, createdAt: serverTimestamp(),
        ...(role === "admin" ? {approvedBy: profile.uid, approvedAt: serverTimestamp()} : {})
      });
      setMessage(role === "admin" ? "تم إصدار شهادة التقدير للمعلم." : "تم إرسال الشهادة للمدير للمراجعة. لن تظهر للطالب قبل اعتمادها.");
      setSelectedUid(""); setReason("");
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
  if (view) return <section dir="rtl">
    <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { body * { visibility: hidden !important; } .certificate-print, .certificate-print * { visibility: visible !important; } .certificate-print { position: absolute; inset: 0; width: 100%; } .certificate-actions { display:none !important; } }`}</style>
    <div className="certificate-print" style={{background:"#fff",color:"#243047",border:"12px double #c49a42",padding:"34px",minHeight:"470px",textAlign:"center",position:"relative",fontFamily:"Tahoma,Arial",boxSizing:"border-box"}}>
      <div style={{border:"2px solid #d9bd78",padding:"26px",minHeight:"390px"}}>
        <div style={{fontSize:30,color:"#b58b35"}}>✦ ✦ ✦</div>
        <h2 style={{color:"#17365d",fontSize:30,margin:"8px 0"}}>منصة المستقبل التعليمية</h2>
        <p style={{color:"#a47c2c",fontSize:25,fontWeight:700,margin:"10px 0"}}>{view.title}</p>
        <p style={{fontSize:19,margin:"14px 0"}}>تتشرف منصة المستقبل التعليمية بمنح هذه الشهادة إلى</p>
        <h1 style={{fontSize:38,color:"#17365d",margin:"18px 0",borderBottom:"2px solid #d9bd78",display:"inline-block",padding:"0 40px 10px"}}>{view.recipientName}</h1>
        <p style={{fontSize:19,margin:"14px auto",maxWidth:700,lineHeight:1.9}}>{view.reason}</p>
        <p style={{fontSize:16,marginTop:25}}>تاريخ الإصدار: {dateText(view.approvedAt || view.createdAt)}　 |　 رقم الشهادة: {view.number}</p>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:25,fontSize:15,color:"#526078"}}><span>إدارة منصة المستقبل التعليمية</span><span>مع أطيب التمنيات بدوام التفوق والنجاح</span></div>
        <div style={{fontSize:24,color:"#b58b35",marginTop:8}}>✦ ✦ ✦</div>
      </div>
    </div>
    <div className="row certificate-actions" style={{marginTop:16}}><button className="btn" onClick={() => window.print()}>تنزيل PDF / طباعة</button><button className="link" onClick={() => setView(null)}>رجوع</button></div>
  </section>;

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
      {certs.filter(c => c.status === "approved" || (role === "teacher" && c.createdBy === profile.uid && c.status === "pending")).length === 0
        ? <p className="note">لا توجد شهادات حتى الآن.</p>
        : certs.filter(c => c.status === "approved" || (role === "teacher" && c.createdBy === profile.uid && c.status === "pending")).map(c => <div className="row" key={c.id} style={{justifyContent:"space-between",flexWrap:"wrap"}}>
          <span><b>{c.recipientName}</b> — {c.title}<small style={{display:"block"}}>{c.status === "pending" ? "قيد اعتماد المدير" : "معتمدة"} · {c.number}</small></span>
          {c.status === "approved" && <button className="mini" onClick={() => setView(c)}>عرض / PDF / طباعة</button>}
        </div>)}
    </section>}
    {message && <p className={message.startsWith("لم") || message.startsWith("تعذر") ? "err" : "ok"} role="status">{message}</p>}
  </section>;
}
