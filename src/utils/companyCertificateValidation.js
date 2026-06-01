import {
    buildCertificateDescription,
    CERTIFICATE_TYPE_OPTIONS,
    formatCertificateIssuedToLabel,
} from '@/utils/companyCertificateUtils';

const ISSUED_BY_REGEX = /^[A-Za-z0-9\s]{2,150}$/;

export function stripDangerousText(value) {
    if (value === undefined || value === null) return '';
    let str = String(value).trim();
    str = str.replace(/<[^>]*>?/gm, '');
    if (/<|>|javascript:|on\w+=/i.test(str)) return '';
    return str;
}

export function normalizeCertificateIssuedBy(value) {
    return stripDangerousText(value).replace(/\s+/g, ' ').trim();
}

export function normalizeCertificateDescription(value) {
    return stripDangerousText(value).slice(0, 1000);
}

export function normalizeCertificateOtherType(value) {
    return stripDangerousText(value).slice(0, 50);
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveCertificateTypeName(certificateType, otherType) {
    const bucket = String(certificateType || '').trim();
    if (bucket === 'Others') return normalizeCertificateOtherType(otherType);
    return stripDangerousText(bucket).slice(0, 50);
}

export function validateCertificateType(certificateType, otherType) {
    const bucket = String(certificateType || '').trim();
    if (!bucket) return 'Certificate Type is required';
    if (!CERTIFICATE_TYPE_OPTIONS.includes(bucket)) {
        return 'Certificate Type must be Installer, Safety, Administration, or Others';
    }
    if (bucket === 'Others') {
        const custom = normalizeCertificateOtherType(otherType);
        if (!custom) return 'Certificate Type is required';
        if (custom.length > 50) return 'Certificate Type must be no more than 50 characters';
    }
    return '';
}

export function validateCertificateIssuedBy(value) {
    const normalized = normalizeCertificateIssuedBy(value);
    if (!normalized) return 'Certificate Issued By is required';
    if (normalized.length < 2) return 'Certificate Issued By must be at least 2 characters';
    if (normalized.length > 150) return 'Certificate Issued By must be no more than 150 characters';
    if (!ISSUED_BY_REGEX.test(normalized)) {
        return 'Certificate Issued By may contain only letters, numbers, and spaces';
    }
    return '';
}

export function validateCertificateDescription(value) {
    if (value == null || String(value).trim() === '') return '';
    const normalized = normalizeCertificateDescription(value);
    if (normalized.length > 1000) return 'Certificate Description must be no more than 1000 characters';
    return '';
}

export function validateCertificateIssueDate(value) {
    if (!value) return 'Issue Date is required';
    const d = parseDate(value);
    if (!d) return 'Issue Date must be a valid date';
    if (d.getFullYear() < 1900) return 'Issue Date minimum year is 1900';
    return '';
}

export function validateCertificateHasExpiry(value) {
    const v = String(value || '').toLowerCase();
    if (v !== 'yes' && v !== 'no') return 'Has Expiry is required';
    return '';
}

export function validateCertificateExpiryDate(value, issueDate, hasExpiry) {
    if (String(hasExpiry || '').toLowerCase() !== 'yes') return '';
    if (!value) return 'Expiry Date is required when Has Expiry is Yes';
    const expiry = parseDate(value);
    if (!expiry) return 'Expiry Date must be a valid date';
    if (expiry.getFullYear() < 1900) return 'Expiry Date minimum year is 1900';
    const issue = parseDate(issueDate);
    if (issue && expiry <= issue) return 'Expiry Date must be greater than Issue Date';
    return '';
}

export function buildCertificateRecipientOptions({ companyId, companyName, employees = [] } = {}) {
    const opts = [];
    const cid = String(companyId || '').trim();
    const cname = String(companyName || '').trim();
    if (cid) {
        opts.push({
            value: `company:${cid}`,
            label: cname ? `${cname} (${cid})` : cid,
        });
    }
    for (const emp of employees || []) {
        const id = String(emp?.employeeId || '').trim();
        if (!id) continue;
        const full = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        opts.push({
            value: `employee:${id}`,
            label: full ? `${full} (${id})` : id,
        });
    }
    return opts;
}

export function validateCertificateIssuedTo(value, recipientOptions = []) {
    const key = String(value || '').trim();
    if (!key) return 'Certificate Issued To is required';
    const allowed = new Set((recipientOptions || []).map((o) => String(o.value || '').trim()));
    if (!allowed.has(key)) {
        return 'Certificate Issued To must be a valid Company ID or Individual ID';
    }
    const label = formatCertificateIssuedToLabel(key, {
        companyId: key.startsWith('company:') ? key.slice(8) : '',
        companyName: '',
        employees: [],
    });
    const display = (recipientOptions.find((o) => o.value === key) || {}).label || label || key;
    if (display.length > 150) return 'Certificate Issued To must be no more than 150 characters';
    return '';
}

export function validateCertificatePdfFile(file, { requireAttachment = true, existingAttachment = null } = {}) {
    if (!file && !existingAttachment) {
        return requireAttachment ? 'Certificate Attachment is required' : '';
    }
    if (!file) return '';
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.pdf')) return 'Only PDF files are allowed';
    const mime = String(file.type || '').toLowerCase();
    if (mime && mime !== 'application/pdf') return 'Only PDF files are allowed (application/pdf)';
    if (file.size > 10 * 1024 * 1024) return 'File size must not exceed 10MB';
    if (file.size <= 0) return 'Certificate Attachment cannot be empty';
    return '';
}

export function validateCompanyCertificateFields(data, opts = {}) {
    const errors = {};
    const {
        requireAttachment = true,
        existingAttachment = null,
        recipientOptions = [],
    } = opts;

    const typeErr = validateCertificateType(data?.certificateType, data?.otherType);
    if (typeErr) errors.type = typeErr;

    const issuedByErr = validateCertificateIssuedBy(data?.issuedBy);
    if (issuedByErr) errors.issuedBy = issuedByErr;

    const descErr = validateCertificateDescription(data?.description);
    if (descErr) errors.description = descErr;

    const issueErr = validateCertificateIssueDate(data?.issueDate);
    if (issueErr) errors.issueDate = issueErr;

    const hasExpiryErr = validateCertificateHasExpiry(data?.hasExpiry);
    if (hasExpiryErr) errors.hasExpiry = hasExpiryErr;

    const expiryErr = validateCertificateExpiryDate(
        data?.expiryDate,
        data?.issueDate,
        data?.hasExpiry,
    );
    if (expiryErr) errors.expiryDate = expiryErr;

    const issuedToErr = validateCertificateIssuedTo(data?.issuedTo, recipientOptions);
    if (issuedToErr) errors.issuedTo = issuedToErr;

    const fileErr = validateCertificatePdfFile(data?.attachmentFile, {
        requireAttachment,
        existingAttachment: data?.attachment || existingAttachment,
    });
    if (fileErr) errors.attachment = fileErr;

    return errors;
}

export function normalizeCompanyCertificatePayload(data, meta = {}) {
    const typeName = resolveCertificateTypeName(data?.certificateType, data?.otherType);
    const issuedBy = normalizeCertificateIssuedBy(data?.issuedBy);
    const issuedToLabel = formatCertificateIssuedToLabel(data?.issuedTo, meta);
    return {
        type: typeName,
        description: buildCertificateDescription({
            issuedBy,
            issuedToLabel,
            description: normalizeCertificateDescription(data?.description),
        }),
        context: 'certificate',
        issueDate: data?.issueDate || '',
        expiryDate: String(data?.hasExpiry || '').toLowerCase() === 'yes' ? data?.expiryDate || '' : '',
    };
}
