import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Env - Log clear error if missing
const requiredKeys = [
    'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
] as const;

if (typeof window !== 'undefined') {
    const missing = requiredKeys.filter(key => !firebaseConfig[key]);
    if (missing.length > 0) {
        console.error(`Missing Firebase Environment Variables: ${missing.join(', ')}. Check your .env.local file.`);
    }
}

// Singleton pattern for Firebase App
export const app: FirebaseApp = !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp();
