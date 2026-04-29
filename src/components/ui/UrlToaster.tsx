"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function UrlToaster({
    error,
    success,
    msg
}: {
    error?: string;
    success?: string;
    msg?: string;
}) {
    useEffect(() => {
        const errorConfigs: Record<string, string> = {
            invalid_credentials: 'Invalid email or password.',
            email_not_verified: 'Please verify your email before logging in.',
            rate_limited: 'Too many attempts. Please try again later.',
            bot_detected: 'Security check failed. Please try again.',
            validation: 'Validation error.',
            signup_failed: 'Signup failed.',
            org_creation_failed: 'Failed to create workspace.'
        };

        const successConfigs: Record<string, string> = {
            signup_pending: 'Account created! Check your email to verify before signing in.',
            reset_sent: 'Password reset link sent to your email.',
            password_updated: 'Password updated successfully. Please log in.'
        };

        if (error) {
            const finalMsg = msg ? decodeURIComponent(msg) : (errorConfigs[error] || 'Something went wrong.');
            toast.error(finalMsg);
        } else if (success) {
            const finalMsg = msg ? decodeURIComponent(msg) : (successConfigs[success] || 'Success!');
            toast.success(finalMsg);
        }
    }, [error, success, msg]);

    return null;
}
