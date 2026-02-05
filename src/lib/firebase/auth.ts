import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    Auth
} from "firebase/auth";
import { app } from "./client";

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Ensure persistence is set to local (default in web SDK, but good to be explicit)
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth persistence error:", error);
});
