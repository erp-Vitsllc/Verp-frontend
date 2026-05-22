/** File picker: PDF and images (JPEG/PNG only). */
export const ERP_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

export const ALLOWED_ATTACHMENT_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export function isAllowedAttachmentFile(file) {
    if (!file) return false;
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const mimeOk = !type || ALLOWED_ATTACHMENT_MIMES.has(type);
    return extOk || mimeOk;
}

export function validateAttachmentFile(file) {
    if (!file) return { ok: false, message: 'No file selected.' };
    if (!isAllowedAttachmentFile(file)) {
        return { ok: false, message: 'Only PDF, JPG, and PNG files are allowed.' };
    }
    return { ok: true };
}

/**
 * Wrap a file input onChange: blocks disallowed types and clears the input.
 * @returns {{ blocked: boolean, message?: string } | null}
 */
export function guardAttachmentFileChange(event, onAllowed) {
    const file = event?.target?.files?.[0];
    if (!file) {
        onAllowed?.(event, null);
        return null;
    }
    const check = validateAttachmentFile(file);
    if (!check.ok) {
        if (event.target) event.target.value = '';
        return { blocked: true, message: check.message };
    }
    onAllowed?.(event, file);
    return null;
}
