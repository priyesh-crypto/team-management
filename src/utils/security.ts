/**
 * Security utilities for input validation and sanitization.
 */

/**
 * Basic XSS sanitization - removes script tags and other dangerous HTML.
 * Note: React handles most XSS during rendering, but this adds a second layer of defense.
 */
export function sanitizeString(val: string | null | undefined): string {
    if (!val) return "";
    return val
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/[<>]/g, "") // Strip brackets
        .trim();
}

/**
 * Validates an email address format.
 */
export function validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validates a UUID (standard for Supabase IDs).
 */
export function validateId(id: string | null | undefined): boolean {
    if (!id) return false;
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return re.test(id);
}

/**
 * Checks file security (size and type).
 */
export const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function checkFileSecurity(file: File): { allowed: boolean; reason?: string } {
    if (file.size > MAX_FILE_SIZE) {
        return { allowed: false, reason: "File too large (max 10MB)" };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return { allowed: false, reason: `File type ${file.type} not allowed` };
    }
    return { allowed: true };
}

/**
 * Validates password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number).
 */
export function validatePasswordStrength(password: string): boolean {
    return (
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password)
    );
}
