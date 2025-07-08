
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration should be in environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// For debugging: Log the config to see if env vars are loaded.
// You can check this in the terminal where you run `npm run dev`.
console.log("Firebase Config Loaded:", firebaseConfig);

// Critical check to ensure storageBucket is defined.
if (!firebaseConfig.storageBucket) {
    throw new Error("Firebase configuration error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined in your environment variables. Please check your .env or .env.local file and restart the development server.");
}

// Initialize Firebase for server-side and client-side
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);

export { app, storage };
    