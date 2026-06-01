export const MEMO_CATEGORY_OPTIONS = ['HR', 'Admin', 'General', 'Project'];

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeMemoDocumentName(value) {
    return stripDangerousText(value).slice(0, 200);
}

export function normalizeMemoDescription(value) {
    return stripDangerousText(value).slice(0, 4000);
}

export function normalizeMemoCategory(value) {
    const v = stripDangerousText(value);
    if (v === 'Projects') return 'Project';
    return MEMO_CATEGORY_OPTIONS.includes(v) ? v : v;
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function validateMemoDocumentName(value) {
    const normalized = normalizeMemoDocumentName(value);
    if (!normalized) return 'Document Name is required';
    if (normalized.length < 3) return 'Document Name must be at least 3 characters';
    if (normalized.length > 200) return 'Document Name must be no more than 200 characters';
    if (!/[A-Za-z0-9]/.test(normalized)) {
        return 'Document Name must not contain only special characters';
    }
    return '';
}

export function validateMemoIssueDate(value) {
    if (value == null || String(value).trim() === '') return '';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateMemoCategory(value) {
    const normalized = normalizeMemoCategory(value);
    if (!normalized) return 'Category is required';
    if (!MEMO_CATEGORY_OPTIONS.includes(normalized)) {
        return 'Category must be HR, Admin, General, or Project';
    }
    return '';
}

export function validateMemoDescription(value) {
    const normalized = normalizeMemoDescription(value);
    if (!normalized) return 'Description is required';
    if (normalized.length < 10) return 'Description must be at least 10 characters';
    if (normalized.length > 4000) return 'Description must be no more than 4000 characters';
    return '';
}

export function validateMemoPdfFile(file, { requireAttachment = true, existingAttachment = null } = {}) {
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

export function validateCompanyMemoFields(data, opts = {}) {
    const errors = {};
    const { requireAttachment = true, existingAttachment = null } = opts;

    const nameErr = validateMemoDocumentName(data?.type);
    if (nameErr) errors.type = nameErr;

    const issueErr = validateMemoIssueDate(data?.issueDate || data?.startDate);
    if (issueErr) errors.issueDate = issueErr;

    const categoryErr = validateMemoCategory(data?.memoCategory);
    if (categoryErr) errors.memoCategory = categoryErr;

    const descErr = validateMemoDescription(data?.description);
    if (descErr) errors.description = descErr;

    const fileErr = validateMemoPdfFile(data?.attachmentFile, {
        requireAttachment,
        existingAttachment: data?.attachment || existingAttachment,
    });
    if (fileErr) errors.attachment = fileErr;

    return errors;
}

export function normalizeCompanyMemoPayload(data) {
    const issueDate = data?.issueDate || data?.startDate || '';
    return {
        type: normalizeMemoDocumentName(data?.type),
        description: normalizeMemoDescription(data?.description),
        context: 'memo',
        provider: normalizeMemoCategory(data?.memoCategory || 'General'),
        issueDate: issueDate || '',
        startDate: issueDate || '',
        expiryDate: '',
    };
}

export function memoCategorySectionId(category) {
    const normalized = normalizeMemoCategory(category);
    return MEMO_CATEGORY_OPTIONS.includes(normalized) ? normalized : 'General';
}
