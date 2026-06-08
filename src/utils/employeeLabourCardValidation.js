import { validateDate } from '@/utils/validation';

const LABOUR_CARD_NUMBER_REGEX = /^[A-Za-z0-9]{3,50}$/;
const CARD_COPY_MAX_BYTES = 5 * 1024 * 1024;
const CONTRACT_MAX_BYTES = 10 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function normalizeLabourCardNumber(value) {
    return String(value || '').trim().replace(/\s/g, '');
}

export function validateEmployeeLabourCardNumber(value, { existingNumbers = [], skipNumber = '' } = {}) {
    const normalized = normalizeLabourCardNumber(value);
    if (!normalized) return ok('Labour Card number is required');
    if (normalized.length < 3) return ok('Labour Card number must be at least 3 characters');
    if (normalized.length > 50) return ok('Labour Card number must be no more than 50 characters');
    if (!LABOUR_CARD_NUMBER_REGEX.test(normalized)) {
        return ok('Labour Card number may contain only letters and numbers');
    }
    const skip = normalizeLabourCardNumber(skipNumber);
    for (const other of existingNumbers) {
        const n = normalizeLabourCardNumber(other);
        if (n && n === normalized && n !== skip) {
            return ok('Labour Card number must be unique');
        }
    }
    return ok();
}

export function validateEmployeeLabourCardIssueDate(value) {
    if (!value) return ok('Issue date is required');
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Issue date must be a valid date');
    return ok();
}

export function validateEmployeeLabourCardExpiryDate(value, issueDate) {
    if (!value) return ok('Expiry date is required');
    const check = validateDate(value, true);
    if (!check.isValid) return ok(check.error || 'Expiry date must be a valid date');
    if (issueDate) {
        const issue = new Date(issueDate);
        const expiry = new Date(value);
        issue.setHours(0, 0, 0, 0);
        expiry.setHours(0, 0, 0, 0);
        if (expiry <= issue) return ok('Expiry date must be later than the issue date');
    }
    return ok();
}

export const NOTICE_PERIOD_DAY_OPTIONS = [30, 60, 90, 120, 150, 180];

/** Stored value may be days (30–180) or legacy months (1–24). */
export function noticePeriodToDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (NOTICE_PERIOD_DAY_OPTIONS.includes(n)) return n;
    if (n >= 1 && n <= 24) return n * 30;
    return null;
}

/** Map stored DB value to a dropdown option (days). */
export function noticePeriodSelectValue(value) {
    const days = noticePeriodToDays(value);
    if (!days || !NOTICE_PERIOD_DAY_OPTIONS.includes(days)) return '';
    return String(days);
}

export function validateEmployeeLabourCardNoticePeriod(value) {
    if (value === '' || value === null || value === undefined) {
        return ok('Notice period is required');
    }
    if (!noticePeriodToDays(value)) {
        return ok('Please select a valid notice period');
    }
    return ok();
}

function validatePdfFile(file, maxBytes, label) {
    if (!file) return ok(`${label} is required`);
    if (file.size === 0) return ok('Empty files are not allowed');
    if (file.size > maxBytes) {
        const mb = maxBytes / (1024 * 1024);
        return ok(`File size must not exceed ${mb}MB`);
    }
    const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
    const mime = String(file.type || '').toLowerCase();
    if (mime !== 'application/pdf' && ext !== '.pdf') {
        return ok('Only PDF file format is allowed');
    }
    return ok();
}

export function validateEmployeeLabourCardFiles({
    file,
    contractFile,
    hasExistingCardDoc = false,
    hasExistingContractDoc = false,
    requireCardFile = true,
    requireContractFile = true,
} = {}) {
    const errors = {};
    if (requireCardFile && !file && !hasExistingCardDoc) {
        errors.file = 'Labour Card copy is required';
    } else if (file) {
        const check = validatePdfFile(file, CARD_COPY_MAX_BYTES, 'Labour Card copy');
        if (!check.isValid) errors.file = check.error;
    }
    if (requireContractFile && !contractFile && !hasExistingContractDoc) {
        errors.contractFile = 'Labour contract attachment is required';
    } else if (contractFile) {
        const check = validatePdfFile(contractFile, CONTRACT_MAX_BYTES, 'Labour contract attachment');
        if (!check.isValid) errors.contractFile = check.error;
    }
    return errors;
}

function hasLabourCardAttachment(attachment) {
    return Boolean(attachment?.url || attachment?.data || attachment?.name);
}

export function formatNoticeDurationLabel(value) {
    const days = noticePeriodToDays(value);
    if (!days) return '';
    return `${days} days`;
}

export function getEmployeeLabourCardActivationPendingFields(labourCardDetails) {
    const pending = [];
    if (!String(labourCardDetails?.number || '').trim()) pending.push('Labour Card Number');
    if (!labourCardDetails?.issueDate) pending.push('Labour Card Issue Date');
    if (!labourCardDetails?.expiryDate) pending.push('Labour Card Expiry Date');
    if (!labourCardDetails?.noticePeriodMonths) pending.push('Notice Period');
    if (!hasLabourCardAttachment(labourCardDetails?.document)) pending.push('Labour Card Document');
    if (!hasLabourCardAttachment(labourCardDetails?.labourContractAttachment)) {
        pending.push('Labour Contract Attachment');
    }
    return pending;
}

export function isEmployeeLabourCardActivationComplete(labourCardDetails) {
    return getEmployeeLabourCardActivationPendingFields(labourCardDetails).length === 0;
}

export function validateEmployeeLabourCardForm(form = {}, options = {}) {
    const {
        existingNumbers = [],
        skipNumber = '',
        hasExistingCardDoc = false,
        hasExistingContractDoc = false,
        requireFiles = true,
        isRenewal = false,
        requireNoticePeriod = true,
    } = options;

    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('number', validateEmployeeLabourCardNumber(form.number, { existingNumbers, skipNumber }));
    set('issueDate', validateEmployeeLabourCardIssueDate(form.issueDate));
    set('expiryDate', validateEmployeeLabourCardExpiryDate(form.expiryDate, form.issueDate));
    if (requireNoticePeriod) {
        set('noticePeriodMonths', validateEmployeeLabourCardNoticePeriod(form.noticePeriodMonths));
    }

    const fileErrors = validateEmployeeLabourCardFiles({
        file: form.file,
        contractFile: form.contractFile,
        hasExistingCardDoc: isRenewal ? false : hasExistingCardDoc,
        hasExistingContractDoc: isRenewal ? false : hasExistingContractDoc,
        requireCardFile: requireFiles,
        requireContractFile: requireFiles,
    });
    Object.assign(errors, fileErrors);

    return errors;
}

export function calculateExitDateFromNoticePeriod(approvalDate, noticePeriodValue) {
    const days = noticePeriodToDays(noticePeriodValue);
    if (!approvalDate || !days) return null;
    const start = new Date(approvalDate);
    if (Number.isNaN(start.getTime())) return null;
    const exit = new Date(start);
    exit.setDate(exit.getDate() + days);
    return exit;
}

export function formatExitDateFromNoticePeriod(approvalDate, noticePeriodValue) {
    const exit = calculateExitDateFromNoticePeriod(approvalDate, noticePeriodValue);
    if (!exit) return '';
    return exit.toISOString().split('T')[0];
}
