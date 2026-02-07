import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    Auth
} from "firebase/auth";
import { app } from "./client";

export const auth: Auth = getAuth(app);

// Ensure persistence is set to local
// Note: setPersistence acts on the auth instance mainly for client-side state
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth persistence error:", error);
});
