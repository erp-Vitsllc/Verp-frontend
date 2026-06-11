import { validateDate } from '@/utils/validation';

export const SALARY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
export const SALARY_PDF_MAX_BYTES = 10 * 1024 * 1024;

const ok = (error = '') => ({ isValid: !error, error });

export function monthKeyFromDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${d.getMonth()}`;
}

export function validateEmployeeSalaryMonth(value) {
    if (!value || String(value).trim() === '') {
        return ok('For Month is required');
    }
    const check = validateDate(value, true);
    if (!check.isValid) {
        return ok(check.error || 'Please select a valid month and year');
    }
    return ok();
}

export function validateEmployeeSalaryBasicAmount(value, { companySalaryLimit } = {}) {
    const str = String(value ?? '').trim();
    if (!str) return ok('Basic salary is required');
    if (!SALARY_AMOUNT_REGEX.test(str)) {
        return ok('Basic salary must be a positive number with up to 2 decimal places');
    }
    const num = parseFloat(str);
    if (num <= 0) return ok('Basic salary must be greater than 0');
    if (Number.isFinite(companySalaryLimit) && companySalaryLimit > 0 && num > companySalaryLimit) {
        return ok('Basic salary must be less than or equal to company salary limit');
    }
    return ok();
}

export function validateEmployeeSalaryAllowanceAmount(value, label) {
    const str = String(value ?? '').trim();
    if (!str) return ok();
    if (!SALARY_AMOUNT_REGEX.test(str)) {
        return ok(`${label} must be a valid number with up to 2 decimal places`);
    }
    const num = parseFloat(str);
    if (num < 0) return ok(`${label} cannot be negative`);
    return ok();
}

export function calculateEmployeeTotalSalary({
    basic = '',
    houseRentAllowance = '',
    vehicleAllowance = '',
    fuelAllowance = '',
    otherAllowance = '',
} = {}) {
    const parts = [basic, houseRentAllowance, vehicleAllowance, fuelAllowance, otherAllowance];
    const total = parts.reduce((sum, part) => {
        const num = parseFloat(String(part ?? '').trim());
        return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    return total.toFixed(2);
}

export function validateEmployeeSalaryTotal(value) {
    const num = parseFloat(String(value ?? '').trim());
    if (!Number.isFinite(num) || num <= 0) {
        return ok('Total salary must be greater than 0');
    }
    return ok();
}

export function validateEmployeeSalaryOfferLetter({
    file,
    fileBase64,
    hasExistingFile = false,
    requireFile = true,
    requireNewUpload = false,
} = {}) {
    if (requireNewUpload) {
        if (!file) {
            return ok('Salary letter is required — upload a PDF for this increment');
        }
        if (file.size === 0) return ok('Empty files are not allowed');
        if (file.size > SALARY_PDF_MAX_BYTES) return ok('File size must not exceed 10MB');
        const name = String(file.name || '').toLowerCase();
        const mime = String(file.type || '').toLowerCase();
        if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
            return ok('Only PDF files are allowed');
        }
        return ok();
    }

    const hasFile = Boolean(
        file || (typeof fileBase64 === 'string' && fileBase64.trim()),
    );
    if (!hasFile) {
        return requireFile && !hasExistingFile
            ? ok('Salary letter is required')
            : ok();
    }
    if (file) {
        if (file.size === 0) return ok('Empty files are not allowed');
        if (file.size > SALARY_PDF_MAX_BYTES) return ok('File size must not exceed 10MB');
        const name = String(file.name || '').toLowerCase();
        const mime = String(file.type || '').toLowerCase();
        if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
            return ok('Only PDF files are allowed');
        }
    }
    return ok();
}

export function findDuplicateSalaryMonth(salaryHistory = [], fromDate, excludeIndex = null) {
    const key = monthKeyFromDate(fromDate);
    if (!key) return false;
    return salaryHistory.some((entry, idx) => {
        if (excludeIndex != null && idx === excludeIndex) return false;
        return monthKeyFromDate(entry?.fromDate) === key;
    });
}

export function validateEmployeeSalaryForm(form = {}, options = {}) {
    const {
        companySalaryLimit,
        salaryHistory = [],
        excludeHistoryIndex = null,
        hasExistingOfferLetter = false,
        requireOfferLetter = true,
        requireNewOfferLetterUpload = false,
    } = options;

    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };

    set('fromDate', validateEmployeeSalaryMonth(form.fromDate));
    set('basic', validateEmployeeSalaryBasicAmount(form.basic, { companySalaryLimit }));
    set('houseRentAllowance', validateEmployeeSalaryAllowanceAmount(form.houseRentAllowance, 'Home rent allowance'));
    set('vehicleAllowance', validateEmployeeSalaryAllowanceAmount(form.vehicleAllowance, 'Vehicle allowance'));
    set('fuelAllowance', validateEmployeeSalaryAllowanceAmount(form.fuelAllowance, 'Fuel allowance'));
    set('otherAllowance', validateEmployeeSalaryAllowanceAmount(form.otherAllowance, 'Other allowance'));

    const total = calculateEmployeeTotalSalary(form);
    set('totalSalary', validateEmployeeSalaryTotal(total));

    if (findDuplicateSalaryMonth(salaryHistory, form.fromDate, excludeHistoryIndex)) {
        errors.fromDate = 'A salary record for this month already exists';
    }

    set(
        'offerLetter',
        validateEmployeeSalaryOfferLetter({
            file: form.offerLetterFile,
            fileBase64: form.offerLetterFileBase64,
            hasExistingFile: hasExistingOfferLetter,
            requireFile: requireOfferLetter,
            requireNewUpload: requireNewOfferLetterUpload,
        }),
    );

    return errors;
}

export function validateSalaryPdfFile(file) {
    return validateEmployeeSalaryOfferLetter({ file, requireFile: true });
}

function parseSalaryDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function salaryHistoryEntriesMatch(a, b) {
    if (!a || !b) return false;
    if (a._id && b._id) return String(a._id) === String(b._id);
    const keyA = monthKeyFromDate(a.fromDate);
    const keyB = monthKeyFromDate(b.fromDate);
    if (keyA && keyB && keyA === keyB) return true;
    return false;
}

export function resolveOldestSalaryHistoryEntry(salaryHistory = []) {
    const list = Array.isArray(salaryHistory) ? salaryHistory.filter(Boolean) : [];
    if (!list.length) return null;
    return [...list].sort((a, b) => {
        const ta = parseSalaryDate(a?.fromDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        const tb = parseSalaryDate(b?.fromDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        const ca = parseSalaryDate(a?.createdAt)?.getTime() ?? 0;
        const cb = parseSalaryDate(b?.createdAt)?.getTime() ?? 0;
        return ca - cb;
    })[0];
}

export function isOldestSalaryHistoryEntry(entry, salaryHistory = []) {
    const oldest = resolveOldestSalaryHistoryEntry(salaryHistory);
    if (!entry || !oldest) return false;
    return salaryHistoryEntriesMatch(entry, oldest);
}
