import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cached: App | undefined;

export function getAdminApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) {
    cached = existing;
    return cached;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("SERVER_CONFIG_MISSING: FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("SERVER_CONFIG_INVALID: FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON");
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("SERVER_CONFIG_INVALID: service account JSON is missing required fields");
  }
  const expectedProject = process.env.VITE_FIREBASE_PROJECT_ID;
  if (expectedProject && serviceAccount.project_id !== expectedProject) {
    throw new Error("SERVER_CONFIG_INVALID: service account project does not match the web app");
  }
  cached = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: serviceAccount.project_id,
  });
  return cached;
}

export function getAdminServices() {
  const app = getAdminApp();
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function bearerToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const value = req.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function sendMethodNotAllowed(res: any, allowed = "POST") {
  res.setHeader("Allow", allowed);
  return res.status(405).json({ error: "Method not allowed" });
}
