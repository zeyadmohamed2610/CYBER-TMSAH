/**
 * Centralized error handling utilities
 * Provides better error messages and consistent error handling across the app
 */

export class AppError extends Error {
    constructor(
        message: string,
        public code?: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export interface ErrorDisplayConfig {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
    action?: {
        label: string;
        onClick: () => void;
    };
}

/**
 * Map technical errors to user-friendly Arabic messages
 */
export const errorMessageMap: Record<string, string> = {
    // Network errors
    'network_error': 'خطأ في الاتصال بالإنترنت. يرجى التحقق من اتصالك.',
    'timeout': 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.',
    'offline': 'أنت غير متصل بالإنترنت.',

    // Auth errors
    'invalid_credentials': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    'session_expired': 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
    'unauthorized': 'ليس لديك صلاحية للوصول.',
    'forbidden': 'لا يمكن لكperforming this action.',

    // Database errors
    'not_found': 'العنصر المطلوب غير موجود.',
    'duplicate': 'هذا العنصر موجود بالفعل.',
    'constraint_violation': 'بيانات غير صالحة. يرجى التحقق من المدخلات.',
    'foreign_key_violation': 'يرجى اختيار عنصر صالح.',

    // Rate limiting
    'rate_limit_exceeded': 'طلبات كثيرة جداً. يرجى المحاولة لاحقاً.',
    'too_many_requests': 'Too many requests. Please try again later.',

    // General
    'unknown': 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    'server_error': 'خطأ في الخادم. يرجى المحاولة لاحقاً.',
    'validation_error': 'بيانات غير صالحة.',
};

/**
 * Get user-friendly Arabic error message
 */
export function getFriendlyErrorMessage(error: unknown): string {
    if (!error) return errorMessageMap.unknown;

    const errorStr = String(error).toLowerCase();

    // Check for specific error patterns
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
        return errorMessageMap.network_error;
    }
    if (errorStr.includes('timeout')) {
        return errorMessageMap.timeout;
    }
    if (errorStr.includes('offline') || !navigator.onLine) {
        return errorMessageMap.offline;
    }
    if (errorStr.includes('auth') || errorStr.includes('token')) {
        return errorMessageMap.session_expired;
    }
    if (errorStr.includes('rate') || errorStr.includes('429')) {
        return errorMessageMap.rate_limit_exceeded;
    }
    if (errorStr.includes('not found') || errorStr.includes('404')) {
        return errorMessageMap.not_found;
    }
    if (errorStr.includes('duplicate') || errorStr.includes('23505')) {
        return errorMessageMap.duplicate;
    }
    if (errorStr.includes('foreign key') || errorStr.includes('23503')) {
        return errorMessageMap.foreign_key_violation;
    }
    if (errorStr.includes('validation') || errorStr.includes('400')) {
        return errorMessageMap.validation_error;
    }
    if (errorStr.includes('500') || errorStr.includes('server')) {
        return errorMessageMap.server_error;
    }

    // Default: return the error as-is if it's short, otherwise generic message
    if (errorStr.length < 100) {
        return errorStr;
    }

    return errorMessageMap.unknown;
}

/**
 * Check if error indicates no network connection
 */
export function isNetworkError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error).toLowerCase();
    return (
        errorStr.includes('network') ||
        errorStr.includes('fetch') ||
        errorStr.includes('offline') ||
        !navigator.onLine
    );
}

/**
 * Check if error indicates authentication/session issue
 */
export function isAuthError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error).toLowerCase();
    return (
        errorStr.includes('auth') ||
        errorStr.includes('token') ||
        errorStr.includes('session') ||
        errorStr.includes('unauthorized') ||
        errorStr.includes('401') ||
        errorStr.includes('403')
    );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (isNetworkError(error)) return true;

    const errorStr = String(error).toLowerCase();
    return (
        errorStr.includes('timeout') ||
        errorStr.includes('429') ||
        errorStr.includes('500') ||
        errorStr.includes('503')
    );
}
