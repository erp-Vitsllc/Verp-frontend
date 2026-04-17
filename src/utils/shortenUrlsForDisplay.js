/**
 * Collapses http(s) URLs to a short label for notification / list UI (matches backend behavior).
 */
export const shortenUrlsForDisplay = (input) => {
    if (input == null || typeof input !== 'string') return '';
    return input.replace(/https?:\/\/[^\s|]+/gi, (raw) => {
        try {
            const { pathname } = new URL(raw);
            const seg = pathname.split('/').filter(Boolean).pop();
            if (seg) {
                try {
                    return decodeURIComponent(seg);
                } catch {
                    return seg;
                }
            }
        } catch {
            /* invalid URL */
        }
        return '[link]';
    });
};
