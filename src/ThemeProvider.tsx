import { ReactNode,useEffect } from "react";
import { doc,onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
const defaults={navy:"#087eaa",navy2:"#16a8d5",bg:"#f1fbff",ink:"#14213d",panel:"#ffffff",line:"#ccecf7",accent:"#079bc8"};
const safeImage=(v:unknown)=>typeof v==="string"&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)?v:"";
const opacity=(v:unknown,d:number)=>Math.min(1,Math.max(0,Number.isFinite(Number(v))?Number(v):d));
export default function ThemeProvider({children}:{children:ReactNode}){
useEffect(()=>{const root=document.documentElement;const apply=(v:Record<string,unknown>)=>{
Object.entries(defaults).forEach(([k,f])=>{const x=v[k];root.style.setProperty("--"+k,typeof x==="string"&&/^#[0-9a-fA-F]{6}$/.test(x)?x:f);});
const fonts=["Cairo, Tahoma, sans-serif","Tahoma, Arial, sans-serif","Arial, sans-serif","Georgia, serif","'Trebuchet MS', sans-serif","Verdana, sans-serif","'Segoe UI', Tahoma, sans-serif","'Times New Roman', serif","system-ui, sans-serif","'Courier New', monospace"];
root.style.setProperty("--platform-font-family",typeof v.fontFamily==="string"&&fonts.includes(v.fontFamily)?v.fontFamily:fonts[0]);
root.dataset.iconTheme=["colorful","soft","minimal","large"].includes(String(v.iconTheme))?String(v.iconTheme):"colorful";
const bg=safeImage(v.backgroundImageData),brand=safeImage(v.brandImageData),kids=safeImage(v.kidsImageData);
root.style.setProperty("--platform-bg-image",bg?'url("'+bg+'")':"none");root.style.setProperty("--brand-bg-image",brand?'url("'+brand+'")':"none");root.style.setProperty("--kids-bg-image",kids?'url("'+kids+'")':"none");
root.style.setProperty("--platform-bg-opacity",String(opacity(v.backgroundOpacity,.25)));root.style.setProperty("--brand-bg-opacity",String(opacity(v.brandOpacity,.3)));root.style.setProperty("--kids-bg-opacity",String(opacity(v.kidsOpacity,.3)));
};apply(defaults);return onSnapshot(doc(db,"themeSettings","global"),s=>apply(s.exists()?s.data():defaults),()=>apply(defaults));},[]);
return <>{children}</>;
}