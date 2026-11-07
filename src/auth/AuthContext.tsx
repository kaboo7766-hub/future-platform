import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type Role = "admin" | "teacher" | "student" | "parent" | "pending";
export interface Profile { uid: string; name: string; email: string; role: Role; classId?: string; classIds?: string[]; onboarded?: boolean }
interface Ctx {
  profile: Profile | null; loading: boolean;
  login(email: string, pass: string): Promise<void>;
  register(name: string, email: string, pass: string, role: "student" | "parent" | "pending"): Promise<void>;
  logout(): Promise<void>;
  setClass(classId: string): Promise<void>;
  setOnboarded(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!active) return;
      setLoading(true);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (!active || auth.currentUser?.uid !== user.uid) return;
        if (!snapshot.exists()) {
          setProfile(null);
          return;
        }
        const data = snapshot.data();
        if (typeof data.role !== "string" || !["admin", "teacher", "student", "parent", "pending"].includes(data.role)) {
          setProfile(null);
          return;
        }
        setProfile({
          uid: user.uid,
          name: typeof data.name === "string" ? data.name : "",
          email: typeof data.email === "string" ? data.email : (user.email ?? ""),
          role: data.role as Role,
          ...(typeof data.classId === "string" ? { classId: data.classId } : {}),
          ...(Array.isArray(data.classIds) ? { classIds: data.classIds.filter((id: unknown): id is string => typeof id === "string") } : {}),
          ...(typeof data.onboarded === "boolean" ? { onboarded: data.onboarded } : {}),
        });
      } catch (error) {
        console.error("تعذر تحميل ملف المستخدم:", error);
        if (active && auth.currentUser?.uid === user.uid) setProfile(null);
      } finally {
        if (active && auth.currentUser?.uid === user.uid) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const register: Ctx["register"] = async (name, email, pass, role) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName) throw new Error("اكتب الاسم أولًا.");
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const data = { uid: credential.user.uid, name: cleanName, email: cleanEmail, role, createdAt: serverTimestamp() };
    try {
      await setDoc(doc(db, "users", credential.user.uid), data);
      setProfile({ uid: data.uid, name: data.name, email: data.email, role });
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  };

  const currentUid = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.");
    return uid;
  };

  const setClass = async (classId: string) => {
    const uid = currentUid();
    await updateDoc(doc(db, "users", uid), { classId });
    setProfile(current => current?.uid === uid ? { ...current, classId } : current);
  };

  const setOnboarded = async () => {
    const uid = currentUid();
    await updateDoc(doc(db, "users", uid), { onboarded: true });
    setProfile(current => current?.uid === uid ? { ...current, onboarded: true } : current);
  };

  return <AuthCtx.Provider value={{ profile, loading, login, register, logout: () => signOut(auth), setClass, setOnboarded }}>{children}</AuthCtx.Provider>;
}
