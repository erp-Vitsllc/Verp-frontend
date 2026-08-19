/**
 * ERP-wide upload rules (no exceptions):
 * - Images: JPEG only (.jpg / .jpeg), max 2 MB
 * - PDF: max 5 MB
 * - No PNG, WebP, DOC, XLS, etc.
 */

export const ERP_JPEG_MAX_BYTES = 2 * 1024 * 1024;
export const ERP_PDF_MAX_BYTES = 5 * 1024 * 1024;

export const ERP_JPEG_ACCEPT = '.jpg,.jpeg,image/jpeg';
export const ERP_PDF_ACCEPT = '.pdf,application/pdf';
/** Mixed PDF + JPEG pickers */
export const ERP_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,application/pdf,image/jpeg';

/** Short helper for attachment field labels and placeholders */
export const ERP_ATTACHMENT_HINT = 'PDF (max 5 MB) or JPEG (max 2 MB)';

/** @deprecated Use ERP_ATTACHMENT_ACCEPT — kept for older imports */
export const ALLOWED_ATTACHMENT_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/jpg']);

function fileNameLower(file) {
    return String(file?.name || '').toLowerCase();
}

function fileMimeLower(file) {
    return String(file?.type || '').toLowerCase();
}

export function isErpPdfFile(file) {
    if (!file) return false;
    const name = fileNameLower(file);
    const mime = fileMimeLower(file);
    return mime === 'application/pdf' || name.endsWith('.pdf');
}

export function isErpJpegFile(file) {
    if (!file) return false;
    const name = fileNameLower(file);
    const mime = fileMimeLower(file);
    if (name.endsWith('.png') || mime === 'image/png') return false;
    return (
        mime === 'image/jpeg' ||
        mime === 'image/jpg' ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg')
    );
}

/**
 * @param {File|Blob|null|undefined} file
 * @param {{ allowPdf?: boolean, allowJpeg?: boolean }} [options]
 * @returns {{ ok: boolean, message: string, kind: 'pdf'|'jpeg'|null }}
 */
export function validateErpUploadFile(file, options = {}) {
    const allowPdf = options.allowPdf !== false;
    const allowJpeg = options.allowJpeg !== false;

    if (!file) {
        return { ok: false, message: 'No file selected.', kind: null };
    }

    if (isErpPdfFile(file)) {
        if (!allowPdf) {
            return { ok: false, message: 'Only JPEG images are allowed (.jpg / .jpeg).', kind: null };
        }
        if (file.size > ERP_PDF_MAX_BYTES) {
            return { ok: false, message: 'PDF must be 5 MB or less.', kind: 'pdf' };
        }
        return { ok: true, message: '', kind: 'pdf' };
    }

    if (isErpJpegFile(file)) {
        if (!allowJpeg) {
            return { ok: false, message: 'Only PDF files are allowed.', kind: null };
        }
        if (file.size > ERP_JPEG_MAX_BYTES) {
            return { ok: false, message: 'JPEG image must be 2 MB or less.', kind: 'jpeg' };
        }
        return { ok: true, message: '', kind: 'jpeg' };
    }

    if (allowPdf && allowJpeg) {
        return {
            ok: false,
            message: 'Only PDF (max 5 MB) or JPEG (max 2 MB) files are allowed.',
            kind: null,
        };
    }
    if (allowPdf) {
        return { ok: false, message: 'Only PDF files are allowed (max 5 MB).', kind: null };
    }
    return { ok: false, message: 'Only JPEG images are allowed (.jpg / .jpeg, max 2 MB).', kind: null };
}

/** PDF-only helper */
export function validateErpPdfFile(file) {
    return validateErpUploadFile(file, { allowPdf: true, allowJpeg: false });
}

/** JPEG-only helper */
export function validateErpJpegFile(file) {
    return validateErpUploadFile(file, { allowPdf: false, allowJpeg: true });
}

export function isAllowedAttachmentFile(file) {
    return validateErpUploadFile(file, { allowPdf: true, allowJpeg: true }).ok;
}

export function validateAttachmentFile(file) {
    return validateErpUploadFile(file, { allowPdf: true, allowJpeg: true });
}

/**
 * Wrap a file input onChange: blocks disallowed types/sizes and clears the input.
 * @returns {{ blocked: boolean, message?: string } | null}
 */
export function guardAttachmentFileChange(event, onAllowed, options = {}) {
    const file = event?.target?.files?.[0];
    if (!file) {
        onAllowed?.(event, null);
        return null;
    }
    const check = validateErpUploadFile(file, options);
    if (!check.ok) {
        if (event.target) event.target.value = '';
        return { blocked: true, message: check.message };
    }
    onAllowed?.(event, file);
    return null;
}

/**
 * Validate a FileList / array; returns accepted files and first error if any rejected.
 */
export function filterErpUploadFiles(fileList, options = {}) {
    const incoming = Array.from(fileList || []);
    const accepted = [];
    const rejected = [];
    for (const file of incoming) {
        const check = validateErpUploadFile(file, options);
        if (check.ok) accepted.push(file);
        else rejected.push({ file, message: check.message });
    }
    return {
        accepted,
        rejected,
        firstError: rejected[0]?.message || '',
    };
}
