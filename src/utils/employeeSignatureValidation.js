import { validateDate } from '@/utils/validation';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png']);
const BLOCKED_EXT = new Set(['.exe', '.bat', '.cmd', '.apk', '.msi', '.sh', '.ps1', '.com', '.scr']);

const ok = (error = '') => ({ isValid: !error, error });

export function validateSignatureSignedDate(value, { dateOfJoining = '' } = {}) {
    if (!value) return ok('Signed date is required');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(value, true, null, today);
    if (!check.isValid) return ok(check.error || 'Signed date cannot be in the future');
    if (dateOfJoining) {
        const signed = new Date(value);
        const joined = new Date(dateOfJoining);
        signed.setHours(0, 0, 0, 0);
        joined.setHours(0, 0, 0, 0);
        if (signed < joined) return ok('Signed date cannot be earlier than Date of Joining');
    }
    return ok();
}

export function validateSignatureFile({ file, requireFile = true } = {}) {
    if (!file) return requireFile ? ok('Signature image is required') : ok();
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > MAX_FILE_BYTES) return ok('File size must be less than 5MB');
    const name = String(file.name || '');
    if (name.length > MAX_FILENAME_LENGTH) return ok('File name must be no more than 255 characters');
    const ext = `.${name.split('.').pop().toLowerCase()}`;
    if (BLOCKED_EXT.has(ext)) return ok('Executable files are not allowed');
    const mime = String(file.type || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT.has(ext)) {
        return ok('Only JPG, JPEG, and PNG formats are allowed');
    }
    return ok();
}

export function validateSignatureCanvasData(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return ok('Signature image is required');
    if (!dataUrl.startsWith('data:image/')) return ok('Invalid signature image data');
    return ok();
}

export function validateEmployeeSignatureForm(form = {}, { dateOfJoining = '', requireFile = true } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };
    set('signedDate', validateSignatureSignedDate(form.signedDate, { dateOfJoining }));
    if (form.file) set('file', validateSignatureFile({ file: form.file, requireFile: true }));
    else if (form.signatureData) set('file', validateSignatureCanvasData(form.signatureData));
    else if (requireFile) errors.file = 'Signature image is required';
    return errors;
}
