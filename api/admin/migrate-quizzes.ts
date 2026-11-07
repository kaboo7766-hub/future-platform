import { bearerToken, getAdminServices } from "../_lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول أولًا" });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token);
    const adminProfile = await db.collection("users").doc(decoded.uid).get();
    if (adminProfile.data()?.role !== "admin") return res.status(403).json({ error: "هذه العملية للمدير فقط" });

    const snapshot = await db.collection("quizzes").get();
    let migrated = 0;
    let sanitized = 0;
    let skipped = 0;

    for (let offset = 0; offset < snapshot.docs.length; offset += 250) {
      const docs = snapshot.docs.slice(offset, offset + 250);
      const keys = await db.getAll(...docs.map(d => db.collection("quizAnswerKeys").doc(d.id)));
      const lessonRefs = docs.map(d => {
        const lessonId = d.data().lessonId;
        return db.collection("lessons").doc(typeof lessonId === "string" ? lessonId : "__missing__");
      });
      const lessons = await db.getAll(...lessonRefs);
      const batch = db.batch();
      let writes = 0;

      for (let i = 0; i < docs.length; i++) {
        const quizDoc = docs[i];
        const questions = quizDoc.data().questions;
        const lessonClassId = lessons[i].exists ? lessons[i].data()?.classId : quizDoc.data().classId;
        const classPatch = typeof lessonClassId === "string" && quizDoc.data().classId !== lessonClassId
          ? { classId: lessonClassId } : {};
        if (!Array.isArray(questions) || !questions.length) {
          if (Object.keys(classPatch).length) { batch.update(quizDoc.ref, classPatch); writes++; }
          else skipped++;
          continue;
        }

        const containsPublicAnswers = questions.some((question: any) =>
          question && Object.prototype.hasOwnProperty.call(question, "answer")
        );

        // A prior key may already exist while old answers are still exposed in the public quiz.
        // Always remove those fields when a trusted key is present.
        if (keys[i].exists) {
          if (containsPublicAnswers || Object.keys(classPatch).length) {
            const publicQuestions = questions.map(({ answer: _answer, ...question }: any) => question);
            batch.update(quizDoc.ref, { ...classPatch, ...(containsPublicAnswers ? { questions: publicQuestions } : {}) });
            writes++;
            if (containsPublicAnswers) sanitized++;
            else skipped++;
          } else {
            skipped++;
          }
          continue;
        }

        const validAnswers = questions.every((question: any) =>
          question?.type === "fill"
            ? typeof question.answer === "string" && question.answer.trim().length > 0
            : (question?.type === "mcq" || question?.type === "tf") &&
              Number.isInteger(question?.answer) &&
              Array.isArray(question?.options) &&
              question.answer >= 0 &&
              question.answer < question.options.length
        );
        if (!validAnswers) {
          if (Object.keys(classPatch).length) { batch.update(quizDoc.ref, classPatch); writes++; }
          skipped++;
          continue;
        }

        const answers = questions.map((question: any) => question.answer);
        const publicQuestions = questions.map(({ answer: _answer, ...question }: any) => question);
        batch.set(db.collection("quizAnswerKeys").doc(quizDoc.id), {
          quizId: quizDoc.id,
          answers,
          migratedAt: new Date(),
          migratedBy: decoded.uid,
        });
        batch.update(quizDoc.ref, { ...classPatch, questions: publicQuestions });
        writes += 2;
        migrated++;
        sanitized++;
      }

      if (writes) await batch.commit();
    }

    return res.status(200).json({
      migrated,
      sanitized,
      skipped,
      message: "تم تأمين مفاتيح الإجابات وإزالة الإجابات الصحيحة من بيانات الاختبارات العامة",
    });
  } catch (error: any) {
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Quiz migration server configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة الخادم لم تكتمل إعداداتها بعد" });
    }
    console.error("Quiz migration failed:", error);
    return res.status(500).json({ error: "تعذّر ترحيل الاختبارات" });
  }
}
