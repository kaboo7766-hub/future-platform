import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

const recipients = ["kaboo7766@gmail.com", "hagerahmedsaad861998@gmail.com"];
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!serviceAccount.project_id || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, or GMAIL_APP_PASSWORD secret.");
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

const since = Timestamp.fromMillis(Date.now() - 15 * 60 * 1000);
const events = [];
const safe = (value) => String(value ?? "").trim();
const stamp = (value) => value?.toMillis?.() ?? 0;

async function readRecent(collectionName, fieldName) {
  const snapshot = await db.collection(collectionName)
    .where(fieldName, ">=", since)
    .limit(250)
    .get();
  return snapshot.docs;
}

function addEvent(key, title, details, when = new Date()) {
  events.push({ key, title, details: details.filter(Boolean), when });
}

for (const doc of await readRecent("notifications", "at")) {
  const d = doc.data();
  addEvent(`notification:${doc.id}`, safe(d.title) || "إشعار جديد بالمنصة", [
    safe(d.body), d.audience === "all" ? "الجمهور: جميع المستخدمين" : "إشعار موجه لمستخدم محدد",
  ], d.at?.toDate?.() ?? new Date());
}

for (const doc of await readRecent("users", "createdAt")) {
  const d = doc.data();
  if (d.role === "pending") {
    addEvent(`teacher-request:${doc.id}`, "طلب تسجيل معلم جديد", [
      `الاسم: ${safe(d.name) || "غير محدد"}`,
      `البريد: ${safe(d.email) || "غير محدد"}`,
      "يرجى مراجعة الطلب من لوحة إدارة المستخدمين.",
    ], d.createdAt?.toDate?.() ?? new Date());
  }
}

for (const doc of await readRecent("certificates", "createdAt")) {
  const d = doc.data();
  addEvent(`certificate-created:${doc.id}`, "شهادة جديدة على منصة المستقبل التعليمية", [
    `اسم الطالب/المعلم: ${safe(d.recipientName) || "غير محدد"}`,
    `نوع الشهادة: ${safe(d.title) || "شهادة تقدير"}`,
    `سبب التكريم: ${safe(d.reason)}`,
    `الحالة الحالية: ${d.status === "pending" ? "بانتظار اعتماد المدير" : d.status === "approved" ? "معتمدة" : safe(d.status)}`,
    `رقم الشهادة: ${safe(d.number)}`,
  ], d.createdAt?.toDate?.() ?? new Date());
}

for (const doc of await readRecent("certificates", "approvedAt")) {
  const d = doc.data();
  const createdAt = stamp(d.createdAt);
  const approvedAt = stamp(d.approvedAt);
  if (!["approved", "rejected"].includes(d.status) || !approvedAt || (createdAt && approvedAt - createdAt < 10000)) continue;
  addEvent(`certificate-decision:${doc.id}:${d.status}:${approvedAt}`,
    d.status === "approved" ? "تم اعتماد شهادة على المنصة" : "تم رفض شهادة على المنصة", [
      `اسم الطالب/المعلم: ${safe(d.recipientName) || "غير محدد"}`,
      `عنوان الشهادة: ${safe(d.title) || "شهادة تقدير"}`,
      `سبب التكريم: ${safe(d.reason)}`,
      `رقم الشهادة: ${safe(d.number)}`,
      `قرار المدير: ${d.status === "approved" ? "اعتماد" : "رفض"}`,
    ], d.approvedAt.toDate());
}

for (const doc of await readRecent("activityLogs", "at")) {
  const d = doc.data();
  const action = safe(d.action);
  const title = action === "teacher.approve" ? "تم اعتماد حساب معلم"
    : action === "user.role" ? "تم تعديل صلاحية مستخدم"
    : "عملية إدارية جديدة بالمنصة";
  addEvent(`activity:${doc.id}`, title, [
    `نوع العملية: ${action || "غير محدد"}`,
    `المستخدم المستهدف: ${safe(d.target) || "غير محدد"}`,
    `منفذ العملية: ${safe(d.uid) || "غير محدد"}`,
  ], d.at?.toDate?.() ?? new Date());
}

for (const doc of await readRecent("submissions", "gradedAt")) {
  const d = doc.data();
  addEvent(`submission-graded:${doc.id}:${stamp(d.gradedAt)}`, "تم تصحيح واجب على المنصة", [
    `اسم الطالب: ${safe(d.studentName) || "غير محدد"}`,
    `الدرجة: ${d.grade ?? "لم تحدد"} من 100`,
    `ملاحظة المعلم: ${safe(d.feedback) || "لا توجد"}`,
  ], d.gradedAt?.toDate?.() ?? new Date());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

let sent = 0;
for (const event of events) {
  const eventId = createHash("sha256").update(event.key).digest("hex");
  const marker = db.collection("_emailNotificationSent").doc(eventId);
  if ((await marker.get()).exists) continue;

  const details = event.details.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const dateText = new Date(event.when).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  await mailer.sendMail({
    from: `منصة المستقبل التعليمية <${process.env.GMAIL_USER}>`,
    to: recipients.join(","),
    subject: `[منصة المستقبل التعليمية] ${event.title}`,
    text: `${event.title}\n\n${event.details.join("\n")}\n\nالتاريخ: ${dateText}`,
    html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#17233b"><h2>${escapeHtml(event.title)}</h2><ul>${details}</ul><p>التاريخ: ${escapeHtml(dateText)}</p><p>منصة المستقبل التعليمية</p></div>`,
  });

  await marker.set({
    eventKey: event.key,
    title: event.title,
    sentAt: Timestamp.now(),
    recipients,
  });
  sent++;
}
console.log(`Checked ${events.length} events; sent ${sent} email notification(s).`);
