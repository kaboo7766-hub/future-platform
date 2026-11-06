import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { A, S } from "./Assignments";
export default function ChildAssignments({ id }: { id: string }) {
  const [as, setAs] = useState<A[]>([]); const [subs, setSubs] = useState<S[]>([]);
  useEffect(() => {
    const a = onSnapshot(collection(db, "assignments"), s => setAs(s.docs.map(d => ({ id: d.id, ...d.data() } as A))), () => {});
    const b = onSnapshot(query(collection(db, "submissions"), where("uid", "==", id)), s => setSubs(s.docs.map(d => ({ id: d.id, ...d.data() } as S))), () => {});
    return () => { a(); b(); };
  }, [id]);
  return (<><h4>الواجبات</h4>{as.length === 0 ? <p className="note">لا توجد واجبات.</p> : as.map(a => {
    const s = subs.find(x => x.assignmentId === a.id);
    return <p key={a.id}>{a.title}: {!s ? <span className="err">لم يُسلَّم {a.dueDate && `(الموعد ${a.dueDate})`}</span> : s.grade !== undefined ? <span className="ok">الدرجة {s.grade} من 100</span> : "تم التسليم، بانتظار التصحيح"}</p>;
  })}</>);
}
