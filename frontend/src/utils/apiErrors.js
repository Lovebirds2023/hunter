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

export const getApiErrorMessage = (error, fallback = 'Request failed.') => {
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

    return context ? `${message}\n${context}` : message;
};
