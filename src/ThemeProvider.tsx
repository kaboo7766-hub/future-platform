import { ReactNode, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
const defaults = { navy: "#18267a", navy2: "#2b44c9", bg: "#f3f6ff", ink: "#14213d", panel: "#ffffff", line: "#d9e1f5", accent: "#2446c8" };
export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const apply = (values: Record<string, unknown>) => Object.entries(defaults).forEach(([key, fallback]) => {
      const value = values[key];
      document.documentElement.style.setProperty("--" + key, typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback);
    });
    apply(defaults);
    return onSnapshot(doc(db, "themeSettings", "global"), snapshot => apply(snapshot.exists() ? snapshot.data() : defaults), () => apply(defaults));
  }, []);
  return <>{children}</>;
}