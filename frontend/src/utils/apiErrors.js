const detailToText = (detail) => {
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail) && detail.length > 0) {
        return detail
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item?.msg) return item.msg;
                if (item?.message) return item.message;
                return JSON.stringify(item);
            })
            .filter(Boolean)
            .join('\n');
    }
    if (detail && typeof detail === 'object') {
        if (detail.message) return String(detail.message);
        if (detail.error) return String(detail.error);
        return JSON.stringify(detail);
    }
    return '';
};

export const getApiErrorMessage = (error, fallback = 'Request failed.', options = {}) => {
    const { includeContext = true } = options;
    const responseData = error?.response?.data;
    const message =
        detailToText(responseData?.detail) ||
        detailToText(responseData?.message) ||
        detailToText(responseData?.error_description) ||
        detailToText(responseData?.error) ||
        detailToText(error?.message) ||
        fallback;

    const status = error?.response?.status || error?.status || error?.statusCode;
    const method = error?.config?.method ? String(error.config.method).toUpperCase() : '';
    const url = error?.config?.url || '';
    const context = [
        status ? `Status: ${status}` : '',
        method || url ? `Endpoint: ${[method, url].filter(Boolean).join(' ')}` : '',
    ].filter(Boolean).join(' | ');

    return includeContext && context ? `${message}\n${context}` : message;
};

const getStatus = (error) => error?.response?.status || error?.status || error?.statusCode;

const normalizeText = (value) => String(value || '').toLowerCase();

const getRecoveryStep = (error, fallbackStep) => {
    const status = getStatus(error);
    const message = normalizeText(
        detailToText(error?.response?.data?.detail) ||
        detailToText(error?.response?.data?.message) ||
        detailToText(error?.response?.data?.error) ||
        error?.message
    );

    if (error?.code === 'ECONNABORTED' || message.includes('timeout')) {
        return 'The request took too long. Check your connection, keep the app open, and try again.';
    }
    if (error?.message === 'Network Error' || message.includes('network') || message.includes('failed to fetch')) {
        return 'Check your internet connection, keep the app open, and try again.';
    }
    if (status === 401) {
        return 'Sign in again, then come back and try saving once more.';
    }
    if (status === 403) {
        return 'You may not have permission for this action. If this looks wrong, contact support.';
    }
    if (status === 400 || status === 422) {
        return 'Check the required fields, remove anything unusual, and try again.';
    }
    if (status === 413 || message.includes('too large') || message.includes('payload')) {
        return 'Use a smaller image or fewer photos, then try again.';
    }
    if (status >= 500) {
        return 'The server had trouble saving this. Wait a moment and try again.';
    }

    return fallbackStep || 'Your details are still on this screen. Check your connection and try again.';
};

export const getActionableErrorMessage = (error, fallback = 'Something went wrong.', options = {}) => {
    const baseMessage = getApiErrorMessage(error, fallback, { includeContext: false });
    const recoveryStep = getRecoveryStep(error, options.recoveryStep);

    return `${baseMessage}\n\nWhat to do: ${recoveryStep}`;
};

export const getUploadErrorMessage = (error, fallback = 'Upload did not finish.') => {
    const status = getStatus(error);
    const message = normalizeText(error?.message);
    const baseMessage = getApiErrorMessage(error, fallback, { includeContext: false });
    const recoveryStep = status === 413 || message.includes('too large') || message.includes('payload')
        ? 'Use a smaller image or upload fewer photos, then try again.'
        : 'Make sure the photo finished selecting, use a JPG or PNG image, check your connection, and keep the app open while it uploads.';

    return `${baseMessage}\n\nWhat to do: ${recoveryStep}`;
};
