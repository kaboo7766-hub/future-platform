import { bearerToken, getAdminServices } from "./_lib/firebaseAdmin";

function shortName(value: unknown): string {
  const parts = String(value ?? "طالب").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "طالب";
  return parts[0] + " " + parts[1].slice(0, 1) + ".";
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول أولًا" });

    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token);
    const currentUser = await db.collection("users").doc(decoded.uid).get();
    const profile = currentUser.data();

    if (!currentUser.exists || profile?.role !== "student") {
      return res.status(403).json({ error: "لوحة المتصدرين متاحة للطلاب فقط" });
    }
    const classId = typeof profile.classId === "string" ? profile.classId : "";
    if (!classId) return res.status(400).json({ error: "لم يتم تحديد صفك الدراسي بعد" });

    const studentsSnapshot = await db.collection("users")
      .where("classId", "==", classId)
      .where("role", "==", "student")
      .get();

    const students = await Promise.all(studentsSnapshot.docs.map(async studentDoc => {
      const pointsDoc = await db.collection("points").doc(studentDoc.id).get();
      const total = Number(pointsDoc.data()?.total ?? 0);
      return {
        uid: studentDoc.id,
        name: shortName(studentDoc.data().name),
        points: Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
      };
    }));

    students.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "ar"));
    let previousPoints: number | null = null;
    let currentRank = 0;
    const ranked = students.map((student, index) => {
      if (previousPoints !== student.points) currentRank = index + 1;
      previousPoints = student.points;
      return {
        rank: currentRank,
        name: student.name,
        points: student.points,
        isMe: student.uid === decoded.uid
      };
    });

    const me = ranked.find(entry => entry.isMe) ?? null;
    return res.status(200).json({
      leaderboard: ranked.slice(0, 10),
      me,
      totalStudents: ranked.length
    });
  } catch (error: any) {
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Leaderboard API configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة لوحة المتصدرين لم تكتمل إعداداتها بعد." });
    }
    console.error("Leaderboard request failed:", error);
    return res.status(500).json({ error: "حدث خطأ أثناء تحميل لوحة المتصدرين." });
  }
}
