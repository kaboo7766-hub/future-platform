import { ReactNode, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const defaults = { navy: "#18267a", navy2: "#2b44c9", bg: "#f3f6ff", ink: "#14213d", panel: "#ffffff", line: "#d9e1f5", accent: "#2446c8" };
const safeImage = (value: unknown) => typeof value === "string" && /^data:image\\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (values: Record<string, unknown>) => {
      Object.entries(defaults).forEach(([key, fallback]) => {
        const value = values[key];
        root.style.setProperty("--" + key, typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback);
      });
      const background = safeImage(values.backgroundImageData);
      const brand = safeImage(values.brandImageData);
      root.style.setProperty("--platform-bg-image", background ? `url("${background}")` : "none");
      root.style.setProperty("--brand-bg-image", brand ? `url("${brand}")` : "none");
    };
    apply(defaults);
    return onSnapshot(doc(db, "themeSettings", "global"), snapshot => apply(snapshot.exists() ? snapshot.data() : defaults), () => apply(defaults));
  }, []);
  return <>{children}</>;
}
