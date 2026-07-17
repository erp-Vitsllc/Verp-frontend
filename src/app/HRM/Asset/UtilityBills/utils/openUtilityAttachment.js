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

function attachmentBlob(file, onError) {
    if (!file?.dataUrl) {
        onError?.('Attachment file data is missing. Re-upload and try again.');
        return null;
    }

    try {
        const blob = dataUrlToBlob(file.dataUrl);
        if (!blob || blob.size === 0) {
            onError?.('Could not read attachment data.');
            return null;
        }
        return blob;
    } catch (err) {
        onError?.(err?.message || 'Could not read attachment.');
        return null;
    }
}

/**
 * Open attachment in a new tab via blob: URL (view only — no auto-download).
 * @returns {boolean} true if opened
 */
export function openUtilityAttachment(file, { onError } = {}) {
    try {
        const blob = attachmentBlob(file, onError);
        if (!blob) return false;

        const objectUrl = URL.createObjectURL(blob);
        const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');

        if (!win) {
            URL.revokeObjectURL(objectUrl);
            onError?.('Popup blocked. Allow popups to view the file, or use Download.');
            return false;
        }

        // Keep blob alive long enough for the new tab/viewer to load
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
        return true;
    } catch (err) {
        onError?.(err?.message || 'Could not open attachment.');
        return false;
    }
}

/**
 * Download attachment to the user's device.
 * @returns {boolean} true if download was triggered
 */
export function downloadUtilityAttachment(file, { onError } = {}) {
    try {
        const blob = attachmentBlob(file, onError);
        if (!blob) return false;

        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = file.name || 'attachment';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
        return true;
    } catch (err) {
        onError?.(err?.message || 'Could not download attachment.');
        return false;
    }
}
