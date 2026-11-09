import { FieldValue } from "firebase-admin/firestore";
import { bearerToken, getAdminServices } from "../_lib/firebaseAdmin";

const ALLOWED = new Set([
  "curriculumGrades",
  "curriculumSubjects",
  "curriculumUnits",
  "curriculumLessons",
  "curriculumAssessments",
]);
const ID_PATTERN = /^[a-z0-9_-]{1,150}$/i;

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول أولًا" });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token);
    const profile = await db.collection("users").doc(decoded.uid).get();
    if (profile.data()?.role !== "admin") return res.status(403).json({ error: "استيراد المناهج متاح لمدير المنصة فقط" });

    const collectionName = typeof req.body?.collection === "string" ? req.body.collection : "";
    const records = req.body?.records;
    if (!ALLOWED.has(collectionName) || !Array.isArray(records) || records.length < 1 || records.length > 50) {
      return res.status(400).json({ error: "بيانات الاستيراد غير صحيحة. أرسل حتى 50 سجلًا في كل دفعة." });
    }
    if (JSON.stringify(req.body).length > 700000) {
      return res.status(413).json({ error: "حجم الدفعة كبير. قلل عدد السجلات." });
    }

    const prepared = records.map((record: any) => {
      const id = typeof record?.id === "string" ? record.id : "";
      const data = record?.data;
      if (!ID_PATTERN.test(id) || !data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("INVALID_RECORD");
      }
      if (data.published !== false) throw new Error("PUBLISH_NOT_ALLOWED");
      return { id, data };
    });

    const batch = db.batch();
    for (const record of prepared) {
      batch.set(db.collection(collectionName).doc(record.id), {
        ...record.data,
        published: false,
        curriculumSchemaVersion: "1.0.1",
        importedAt: FieldValue.serverTimestamp(),
        importedBy: decoded.uid,
      }, { merge: true });
    }
    await batch.commit();
    return res.status(200).json({ imported: prepared.length, collection: collectionName });
  } catch (error: any) {
    if (error?.message === "INVALID_RECORD") return res.status(400).json({ error: "يوجد سجل بمعرّف أو بيانات غير صالحة." });
    if (error?.message === "PUBLISH_NOT_ALLOWED") return res.status(400).json({ error: "لا يسمح الاستيراد بنشر المحتوى تلقائيًا." });
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Curriculum import server configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة الخادم لم تكتمل إعداداتها بعد." });
    }
    console.error("Curriculum import failed:", error);
    return res.status(500).json({ error: "تعذّر استيراد دفعة المنهج. يمكنك إعادة المحاولة بأمان." });
  }
}
