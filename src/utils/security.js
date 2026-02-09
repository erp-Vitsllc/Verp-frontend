import DOMPurify from 'dompurify';

/**
 * Sanitizes a URL for use in href, src, or iframe src.
 * Prevents javascript: and other dangerous protocols.
 * 
 * @param {string} url - The URL to sanitize
 * @param {boolean} allowBlob - Whether to allow blob: URLs (for downloads/previews)
 * @returns {string} - The sanitized URL or '#' if dangerous
 */
export const sanitizeUrl = (url, allowBlob = true) => {
    if (!url || typeof url !== 'string') return '';

    const trimmedUrl = url.trim();

    // Allow relative paths
    if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
        return trimmedUrl;
    }

    try {
        const parsed = new URL(trimmedUrl);
        const protocol = parsed.protocol.toLowerCase();

        const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'data:'];
        if (allowBlob) safeProtocols.push('blob:');

        if (!safeProtocols.includes(protocol)) {
            console.warn(`Blocked potentially dangerous URL protocol: ${protocol}`);
            return '#';
        }

        // Return the parsed href for normalization
        return parsed.href;
    } catch (e) {
        // If it's not a valid absolute URL, it might be a fragment or relative path
        // but it could also be a dangerous string.
        // To be safe, we check if it starts with common dangerous prefixes
        const dangerous = /^(javascript|data|vbscript|file):/i;
        if (dangerous.test(trimmedUrl)) {
            // 'data:' is already allowed above if it parses as URL, 
            // but if it fails to parse and starts with data:, we block it here.
            // Actually data: usually parses.
            return '#';
        }

        // Use DOMPurify as fallback for strings that don't parse as URLs
        if (typeof window !== 'undefined') {
            return DOMPurify.sanitize(trimmedUrl, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
                RETURN_TRUSTED_TYPE: false
            }) || '#';
        }
    }

    return trimmedUrl;
};
