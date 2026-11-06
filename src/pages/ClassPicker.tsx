import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
export default function ClassPicker() {
  const { profile, setClass } = useAuth();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => onSnapshot(collection(db, "classes"), s => setList(s.docs.map(d => ({ id: d.id, name: d.data().name }))), () => setErr("تعذّر تحميل الصفوف")), []);
  if (!list.length && !err) return null;
  return (<section className="panel"><label>صفّي الدراسي:{" "}
    <select value={profile!.classId ?? ""} onChange={e => e.target.value && setClass(e.target.value).catch(() => setErr("تعذّر حفظ الصف"))}>
      <option value="">اختر صفك</option>{list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {!profile!.classId && <p className="note">اختر صفك لتظهر لك دروسه فقط.</p>}{err && <p className="err" role="alert">{err}</p>}</section>);
}
