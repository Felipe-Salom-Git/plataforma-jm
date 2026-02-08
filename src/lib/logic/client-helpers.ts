export function makeClientId(data: { email?: string | null; telefono?: string | null; }): string {
    const email = data.email?.toLowerCase().trim();
    const phone = data.telefono?.replace(/\D/g, '');

    if (email) {
        // Remove special chars from email for ID, keep @ replacement simple
        const cleanEmail = email.replace(/[^a-z0-9]/g, '_');
        return `client_${cleanEmail}`;
    }

    if (phone && phone.length > 5) {
        return `client_tel_${phone}`;
    }

    // Fallback if neither exists (should be rare/impossible with validation)
    return `client_auto_${Date.now()}`;
}
