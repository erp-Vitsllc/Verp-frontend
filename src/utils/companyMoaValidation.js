export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeMoaVersion(value) {
    return stripDangerousText(value).slice(0, 30);
}

export function normalizeMoaNote(value) {
    return stripDangerousText(value).slice(0, 2000);
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function validateMoaVersion(value) {
    const normalized = normalizeMoaVersion(value);
    if (!normalized) return 'MOA Version is required';
    if (normalized.length > 30) return 'MOA Version must be no more than 30 characters';
    return '';
}

export function validateMoaNote(value) {
    if (value == null || String(value).trim() === '') return '';
    const normalized = normalizeMoaNote(value);
    if (normalized.length > 2000) return 'Note must be no more than 2000 characters';
    return '';
}

export function validateMoaIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateMoaPdfFile(file, { requireAttachment = true, existingAttachment = null } = {}) {
    if (!file && !existingAttachment) {
        return requireAttachment ? 'Attachment is required' : '';
    }
    if (!file) return '';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Attachment cannot be empty';
    return '';
}

export function validateCompanyMoaFields(data, opts = {}) {
    const errors = {};
    const { requireAttachment = true, existingAttachment = null } = opts;

    const versionErr = validateMoaVersion(data?.type);
    if (versionErr) errors.type = versionErr;

    const noteErr = validateMoaNote(data?.description);
    if (noteErr) errors.description = noteErr;

    const issueErr = validateMoaIssueDate(data?.issueDate || data?.startDate);
    if (issueErr) errors.issueDate = issueErr;

    const fileErr = validateMoaPdfFile(data?.attachmentFile, {
        requireAttachment,
        existingAttachment: data?.attachment || existingAttachment,
    });
    if (fileErr) errors.attachment = fileErr;

    return errors;
}

export function normalizeCompanyMoaPayload(data) {
    const issueDate = data?.issueDate || data?.startDate || '';
    return {
        type: normalizeMoaVersion(data?.type),
        description: normalizeMoaNote(data?.description),
        context: 'moa',
        issueDate,
        startDate: issueDate,
        expiryDate: '',
    };
}
