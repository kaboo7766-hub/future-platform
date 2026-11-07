import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type Language = "ar" | "en";
const LanguageContext = createContext<{ language: Language; toggleLanguage: () => void }>({ language: "ar", toggleLanguage: () => {} });

const arToEn: Record<string, string> = {
  "منصة المستقبل التعليمية":"Future Learning Platform","منصة المستقبل":"Future Platform","لوحة المدير":"Admin Dashboard","الرئيسية":"Home","الدروس والصفوف":"Lessons & Classes","الدروس":"Lessons","الواجبات":"Assignments","الألعاب":"Games","شهاداتي":"My Certificates","الاختبارات":"Quizzes","المستخدمون":"Users","محتوى الموقع":"Website Content","الحضور":"Attendance","تسجيل الخروج":"Log out","تسجيل الدخول":"Log in","إنشاء حساب":"Create Account","ابدأ مجانًا":"Start for Free","ابدأ رحلتك التعليمية الآن":"Start Your Learning Journey","كن على اطلاع":"Stay Updated","اختصارات":"Quick Links","لوحتي":"My Dashboard","جارٍ تحميل الصفحة…":"Loading page…","جارٍ تحميل القسم…":"Loading section…","لحظة…":"Please wait…","دخول":"Sign In","إنشاء الحساب":"Create Account","ليس لدي حساب":"Create an account","لدي حساب بالفعل":"I already have an account","الاسم":"Name","البريد الإلكتروني":"Email Address","كلمة المرور":"Password","طالب":"Student","معلم":"Teacher","ولي أمر":"Parent","مدير":"Administrator","معلم قيد الاعتماد":"Teacher Pending Approval","منصة عربية صُنعت من أجلك":"An Arabic Learning Platform Made for You","تعلّم أينما كنت… وتقدّم بثقة":"Learn Anywhere… Grow with Confidence","تسجيل":"Register","متابعة مباشرة من المعلمين":"Direct Teacher Support","متابعة مستمرة":"Continuous Progress Tracking","تقدم الأبناء ونقاط القوة والضعف":"Children’s Progress and Areas to Improve","دروس مكتملة":"Completed Lessons","نقاطي":"My Points","شهاداتي":"My Certificates","واجبات مسلّمة":"Submitted Assignments","المستخدمون":"Users","معلمون بانتظار الاعتماد":"Teachers Awaiting Approval","التسليمات":"Submissions","الدروس التفاعلية":"Interactive Lessons","اختبارات فورية":"Instant Quizzes","ألعاب تعليمية":"Educational Games","متابعة ولي الأمر":"Parent Monitoring","نقاط وشهادات":"Points & Certificates","تجربة آمنة":"Safe Learning Experience","منصة تعليمية عربية متكاملة":"A Complete Learning Platform","من التأسيس إلى السادس الابتدائي":"From Kindergarten to Grade Six","بيئة تعليمية تجمع المتعة والمعرفة":"A Learning Environment That Makes Education Fun","لماذا تختار المنصة؟":"Why Choose Our Platform?","الأسئلة الشائعة":"Frequently Asked Questions","ابدأ الآن":"Get Started","إدارة المحتوى":"Content Management","حفظ":"Save","إلغاء":"Cancel","حذف":"Delete","تعديل":"Edit","إضافة":"Add","بحث":"Search","الكل":"All","المادة":"Subject","الصف":"Grade","الدرس":"Lesson","التاريخ":"Date","الوقت":"Time","الاسم":"Name","الصفة":"Role","عرض":"View","إكمال الدرس":"Complete Lesson","فتح الاختبار":"Open Quiz","نشر":"Publish","مسودة":"Draft","اختر":"Choose","رفع صورة":"Upload Image","الصورة":"Image","رابط":"Link","الملف":"File","المعلمون":"Teachers","الطلاب":"Students","لا توجد بيانات":"No data available","جارٍ الحفظ":"Saving","تم الحفظ":"Saved","حدث خطأ، حاول مرة أخرى":"An error occurred. Please try again","أهلًا":"Welcome","العودة":"Back","التالي":"Next","السابق":"Previous","النتيجة":"Result","الدرجة":"Score","الأسئلة":"Questions","الإعدادات":"Settings","الحساب":"Account","الملف الشخصي":"Profile","مرحبا":"Hello","عرض المزيد":"Show More","إغلاق":"Close","تأكيد":"Confirm","نعم":"Yes","لا":"No","المجموع":"Total","الحالة":"Status","نشط":"Active","غير نشط":"Inactive","قيد الانتظار":"Pending","مكتمل":"Completed","غير مكتمل":"Incomplete","اختر اللغة":"Choose Language","العربية":"Arabic","الإنجليزية":"English"
};
const enToAr = Object.fromEntries(Object.entries(arToEn).map(([ar,en]) => [en,ar])) as Record<string,string>;

function translateTree(root: ParentNode, language: Language) {
  const dict = language === "en" ? arToEn : enToAr;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("script,style,code,pre,textarea")) continue;
    nodes.push(node);
  }
  const keys = Object.keys(dict).sort((a,b) => b.length-a.length);
  for (const node of nodes) {
    let value = node.nodeValue ?? "";
    for (const key of keys) {
      if (value.includes(key)) value = value.split(key).join(dict[key]);
    }
    if (value !== node.nodeValue) node.nodeValue = value;
  }
  if (root instanceof HTMLElement || root instanceof Document) {
    const elements = root instanceof Document ? root.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]") : root.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]");
    elements.forEach(el => {
      for (const attr of ["placeholder","title","aria-label"]) {
        const current = el.getAttribute(attr);
        if (current && dict[current]) el.setAttribute(attr, dict[current]);
      }
    });
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem("future-platform-language") === "en" ? "en" : "ar"; } catch { return "ar"; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.language = language;
    const run = () => translateTree(document, language);
    run();
    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    try { localStorage.setItem("future-platform-language", language); } catch {}
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo(() => ({ language, toggleLanguage: () => setLanguage(v => v === "ar" ? "en" : "ar") }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
