import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface AppConfig {
    staff: string[];
}

const CONFIG_COLLECTION = 'config';
const GENERAL_DOC = 'general';

export const SettingsService = {
    async getSettings(tenantId: string): Promise<AppConfig> {
        const ref = doc(db, 'tenants', tenantId, CONFIG_COLLECTION, GENERAL_DOC);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data() as AppConfig;
        }
        return { staff: [] };
    },

    async updateStaff(tenantId: string, staff: string[]) {
        const ref = doc(db, 'tenants', tenantId, CONFIG_COLLECTION, GENERAL_DOC);
        await setDoc(ref, { staff }, { merge: true });
    }
};
