import { Link } from "react-router-dom";
const stages = ["التأسيس","الصف الأول","الصف الثاني","الصف الثالث","الصف الرابع","الصف الخامس","الصف السادس"];
export default function Home() {
  return (<main>
    <section className="hero">
      <h1>نتعلّم باللعب، ونكبر بالمعرفة</h1>
      <p>دروس وتدريبات للتأسيس والمرحلة الابتدائية، بمتابعة مستمرة من المعلم وولي الأمر.</p>
      <Link to="/login" className="btn">ابدأ مجانًا</Link>
    </section>
    <section className="wrap"><h2>المراحل التعليمية</h2>
      <div className="grid">{stages.map((s, i) => <div key={s} className={`card c${i % 4}`}>{s}</div>)}</div>
    </section>
  </main>);
}
