/**
 * Convert a data URL to a Blob (browsers often blank-out window.open on data: URLs).
 */
export function dataUrlToBlob(dataUrl) {
    const raw = String(dataUrl || '');
    const comma = raw.indexOf(',');
    if (comma < 0) return null;
    const header = raw.slice(0, comma);
    const payload = raw.slice(comma + 1);
    if (!payload) return null;

    const mimeMatch = header.match(/data:([^;,]*)/);
    const mime = (mimeMatch && mimeMatch[1]) || 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);

    try {
        if (isBase64) {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return new Blob([bytes], { type: mime || 'application/octet-stream' });
        }
        return new Blob([decodeURIComponent(payload)], {
            type: mime || 'application/octet-stream',
        });
    } catch {
        return null;
    }
}

/**
 * Open attachment in a new tab via blob: URL (reliable for PDF/images).
 * Falls back to download if the popup is blocked.
 * @returns {boolean} true if opened or download triggered
 */
export function openUtilityAttachment(file, { onError } = {}) {
    if (!file?.dataUrl) {
        onError?.('Attachment file data is missing. Re-upload and try again.');
        return false;
    }

    try {
        const blob = dataUrlToBlob(file.dataUrl);
        if (!blob || blob.size === 0) {
            onError?.('Could not read attachment data.');
            return false;
        }

        const objectUrl = URL.createObjectURL(blob);
        const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');

        if (!win) {
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = file.name || 'attachment';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        // Keep blob alive long enough for the new tab/viewer to load
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
        return true;
    } catch (err) {
        onError?.(err?.message || 'Could not open attachment.');
        return false;
    }
}
