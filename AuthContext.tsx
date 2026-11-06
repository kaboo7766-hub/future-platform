import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type Role = "admin" | "teacher" | "student" | "parent" | "pending";
export interface Profile { uid: string; name: string; email: string; role: Role; classId?: string; onboarded?: boolean }
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
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setProfile(null); setLoading(false); return; }
    const snap = await getDoc(doc(db, "users", u.uid));
    setProfile(prev => (snap.exists() ? (snap.data() as Profile) : prev));
    setLoading(false);
  }), []);
  const login = async (e: string, p: string) => { await signInWithEmailAndPassword(auth, e, p); };
  const register: Ctx["register"] = async (name, email, pass, role) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const data = { uid: cred.user.uid, name: name.trim(), email, role, createdAt: serverTimestamp() };
    await setDoc(doc(db, "users", cred.user.uid), data);
    setProfile({ uid: data.uid, name: data.name, email, role });
  };
  const setClass = async (classId: string) => {
    await updateDoc(doc(db, "users", auth.currentUser!.uid), { classId });
    setProfile(p => (p ? { ...p, classId } : p));
  };
  const setOnboarded = async () => {
    await updateDoc(doc(db, "users", auth.currentUser!.uid), { onboarded: true });
    setProfile(p => (p ? { ...p, onboarded: true } : p));
  };
  return <AuthCtx.Provider value={{ profile, loading, login, register, logout: () => signOut(auth), setClass, setOnboarded }}>{children}</AuthCtx.Provider>;
}
