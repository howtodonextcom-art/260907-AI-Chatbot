type FirebaseApp = import("firebase/app").FirebaseApp;
type Auth = import("firebase/auth").Auth;
type Firestore = import("firebase/firestore").Firestore;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseClientConfigured(): boolean {
  const c = getFirebaseClientConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (typeof window === "undefined") return null;
  if (!isFirebaseClientConfigured()) return null;
  if (app) return app;

  const { initializeApp, getApps } = await import("firebase/app");
  const existing = getApps();
  app = existing[0] ?? initializeApp(getFirebaseClientConfig());
  return app;
}

export async function getClientAuth(): Promise<Auth | null> {
  const firebaseApp = await getFirebaseApp();
  if (!firebaseApp) return null;
  if (auth) return auth;
  const { getAuth } = await import("firebase/auth");
  auth = getAuth(firebaseApp);
  return auth;
}

export async function getClientDb(): Promise<Firestore | null> {
  const firebaseApp = await getFirebaseApp();
  if (!firebaseApp) return null;
  if (db) return db;
  const { getFirestore } = await import("firebase/firestore");
  db = getFirestore(firebaseApp);
  return db;
}
