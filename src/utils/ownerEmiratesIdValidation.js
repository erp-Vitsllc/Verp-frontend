const EMIRATES_ID_REGEX = /^[0-9]{15}$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeEmiratesIdNumber(value) {
    return stripDangerousText(value)
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
        .replace(/\D/g, '');
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

export function validateEmiratesIdNumber(value, { existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizeEmiratesIdNumber(value);
    if (!normalized) return 'Emirates ID Number is required';
    if (normalized.length !== 15) return 'Emirates ID Number must be exactly 15 digits';
    if (!normalized.startsWith('784')) return 'Emirates ID Number must start with 784';
    if (!EMIRATES_ID_REGEX.test(normalized)) {
        return 'Emirates ID Number must contain digits only';
    }
    const skip = normalizeEmiratesIdNumber(skipNumber);
    for (const other of existingNumbers) {
        const n = normalizeEmiratesIdNumber(other);
        if (n && n === normalized && n !== skip) {
            return 'Emirates ID Number must be unique';
        }
    }
    return '';
}

export function validateEmiratesIdIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    const today = startOfDay(new Date());
    if (d > today) return 'Issue Date cannot be in the future';
    return '';
}

export function validateEmiratesIdExpiryDate(value, issueDate) {
    if (!value) return 'Expiry Date is required';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function validateEmiratesIdPdfFile(file) {
    if (!file) return 'Emirates ID document is required';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Emirates ID document cannot be empty';
    return '';
}

export function collectEmiratesIdNumbersFromOwners(owners = [], { skipOwnerIndex = -1 } = {}) {
    const numbers = [];
    owners.forEach((owner, idx) => {
        if (idx === skipOwnerIndex) return;
        const n = owner?.emiratesId?.number;
        if (n) numbers.push(n);
    });
    return numbers;
}

export function validateOwnerEmiratesIdFields(data, opts = {}) {
    const errors = {};
    const { owners = [], ownerIndex = -1, requireAttachment = true } = opts;

    const existingNumbers = collectEmiratesIdNumbersFromOwners(owners, { skipOwnerIndex: ownerIndex });
    const skipNumber = owners[ownerIndex]?.emiratesId?.number || '';

    const numberErr = validateEmiratesIdNumber(data?.number, { existingNumbers, skipNumber });
    if (numberErr) errors.number = numberErr;

    const issueErr = validateEmiratesIdIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const expiryErr = validateEmiratesIdExpiryDate(data?.expiryDate, data?.issueDate);
    if (expiryErr) errors.expiryDate = expiryErr;

    if (requireAttachment && !data?.attachment) {
        errors.attachment = 'Emirates ID document is required';
    }

    return errors;
}

export function normalizeOwnerEmiratesIdPayload(data) {
    return {
        number: normalizeEmiratesIdNumber(data?.number),
        issueDate: data?.issueDate || '',
        expiryDate: data?.expiryDate || '',
        attachment: data?.publicId || data?.attachment || null,
    };
}
