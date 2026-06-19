import { validateDate } from '@/utils/validation';

export const WORK_STATUS_VALUES = ['Probation', 'Permanent', 'Temporary', 'Notice', 'Left User'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 100;

const ok = (error = '') => ({ isValid: !error, error });

function parseIsoDate(value) {
    if (!value) return null;
    const s = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (!s) return null;
    const d = new Date(s[1]);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize API / Date object values to YYYY-MM-DD for strict date validation. */
function toIsoDateString(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return '';
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD for date pickers and form fields. */
export function normalizeDateForPicker(value) {
    return toIsoDateString(value);
}

function isLabourCardDocumentType(type) {
    return String(type || '').trim().toLowerCase() === 'labour card';
}

const VISA_DOCUMENT_TYPES = new Set([
    'visit visa',
    'employment visa',
    'spouse visa',
    'third party',
]);

function isVisaDocumentType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (VISA_DOCUMENT_TYPES.has(normalized)) return true;
    return normalized.endsWith(' visa');
}

/** Earliest visa issue date — used as contract joining date (survives renewals). */
export function resolveFirstVisaIssueDate(employee = {}) {
    const candidates = [];
    const add = (value) => {
        const iso = toIsoDateString(value);
        if (iso) candidates.push(iso);
    };

    const pendingChanges = Array.isArray(employee?.pendingReactivationChanges)
        ? employee.pendingReactivationChanges
        : [];
    pendingChanges
        .filter((entry) => String(entry?.section || '').toLowerCase() === 'visa')
        .forEach((entry) => {
            if (entry?.proposedData?.issueDate && entry?.isRenewal !== true) {
                add(entry.proposedData.issueDate);
            }
        });

    const visaDetails = employee?.visaDetails || {};
    ['visit', 'employment', 'spouse'].forEach((type) => {
        add(visaDetails[type]?.issueDate);
    });

    if (Array.isArray(employee?.oldDocuments)) {
        employee.oldDocuments.forEach((doc) => {
            if (isVisaDocumentType(doc?.type)) add(doc.issueDate);
        });
    }

    if (candidates.length === 0) return '';
    return candidates.sort()[0];
}

/** Earliest labour card issue date (labour card workflows only — not contract joining). */
export function resolveFirstLabourCardIssueDate(employee = {}) {
    const candidates = [];
    const add = (value) => {
        const iso = toIsoDateString(value);
        if (iso) candidates.push(iso);
    };

    const pendingLabour = (Array.isArray(employee?.pendingReactivationChanges)
        ? employee.pendingReactivationChanges
        : []).find((e) => String(e?.section || '').toLowerCase() === 'labourcard');
    if (pendingLabour?.proposedData?.issueDate && pendingLabour?.isRenewal !== true) {
        add(pendingLabour.proposedData.issueDate);
    }

    add(employee?.labourCardDetails?.issueDate);
    if (Array.isArray(employee?.oldDocuments)) {
        employee.oldDocuments.forEach((doc) => {
            if (isLabourCardDocumentType(doc?.type)) add(doc.issueDate);
        });
    }

    if (candidates.length === 0) return '';
    return candidates.sort()[0];
}

/** Current labour card issue date (pending activation proposal or live record). */
export function resolveLabourCardIssueDate(employee = {}) {
    const pendingLabour = (Array.isArray(employee?.pendingReactivationChanges)
        ? employee.pendingReactivationChanges
        : []).find((e) => String(e?.section || '').toLowerCase() === 'labourcard');
    if (pendingLabour?.proposedData?.issueDate) {
        return toIsoDateString(pendingLabour.proposedData.issueDate);
    }
    return toIsoDateString(employee?.labourCardDetails?.issueDate) || '';
}

/** Contract joining date — always the first visa issue date, never the latest renewal. */
export function resolveContractJoiningDate(employee = {}) {
    const fromVisa = resolveFirstVisaIssueDate(employee);
    if (fromVisa) return fromVisa;
    return toIsoDateString(employee?.contractJoiningDate) || '';
}

function calculateAgeOnDate(birthIso, onIso) {
    const birth = parseIsoDate(birthIso);
    const on = parseIsoDate(onIso);
    if (!birth || !on) return null;
    let age = on.getFullYear() - birth.getFullYear();
    const md = on.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && on.getDate() < birth.getDate())) age--;
    return age;
}

export function normalizeCompanyEmail(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

export function validateCompanyEmail(value, { required = false } = {}) {
    const email = normalizeCompanyEmail(value).toLowerCase();
    if (!email) return required ? ok('Company email is required') : ok();
    if (email.length > MAX_EMAIL_LENGTH) return ok('Company email must be no more than 100 characters');
    if (!EMAIL_REGEX.test(email)) return ok('Please enter a valid email address');
    return ok();
}

export function validateDateOfJoining(value, { dateOfBirth = '' } = {}) {
    if (!value) return ok('Date of Joining is required');
    const normalized = toIsoDateString(value);
    if (!normalized) return ok('Please enter a valid date (YYYY-MM-DD)');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const check = validateDate(normalized, true, null, today);
    if (!check.isValid) return ok(check.error || 'Date of Joining cannot be in the future');
    if (dateOfBirth) {
        const age = calculateAgeOnDate(dateOfBirth, normalized);
        if (age !== null && age < 18) {
            return ok('Employee must be at least 18 years old on the joining date');
        }
    }
    return ok();
}

export function validateContractJoiningDate(value, dateOfJoining, { allowFuture = false } = {}) {
    if (!value) return ok('Contract Joining Date is required');
    const normalized = toIsoDateString(value);
    if (!normalized) return ok('Please enter a valid date (YYYY-MM-DD)');
    if (!allowFuture) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const check = validateDate(normalized, true, null, today);
        if (!check.isValid) return ok(check.error || 'Contract Joining Date cannot be in the future');
    }
    if (dateOfJoining) {
        const issue = parseIsoDate(dateOfJoining);
        const contract = parseIsoDate(normalized);
        if (issue && contract) {
            issue.setHours(0, 0, 0, 0);
            contract.setHours(0, 0, 0, 0);
            if (contract < issue) return ok('Contract Joining Date cannot be earlier than Date of Joining');
        }
    }
    return ok();
}

export function validateWorkCompany(value) {
    if (!value || (typeof value === 'string' && !value.trim())) {
        return ok('Company is required');
    }
    return ok();
}

export function validateWorkDepartment(value) {
    if (!value || !String(value).trim()) return ok('Department is required');
    return ok();
}

export function validateWorkDesignation(value) {
    if (!value || !String(value).trim()) return ok('Designation is required');
    return ok();
}

export function validateWorkStatus(value) {
    if (!value || !String(value).trim()) return ok('Work Status is required');
    if (!WORK_STATUS_VALUES.includes(value)) return ok('Invalid work status');
    return ok();
}

export function validateReportingAuthority(value, { employeeRecordId = '', employeeEmployeeId = '' } = {}) {
    if (!value || !String(value).trim()) return ok();
    const v = String(value).trim();
    if (employeeRecordId && v === String(employeeRecordId)) {
        return ok('Employee cannot report to themselves');
    }
    if (employeeEmployeeId && v === String(employeeEmployeeId)) {
        return ok('Employee cannot report to themselves');
    }
    return ok();
}

export function validatePrimaryReportee(value, { employeeRecordId = '', employeeEmployeeId = '', department = '' } = {}) {
    const dept = String(department || '').trim().toLowerCase();
    const isManagement = dept === 'management';
    if (!isManagement && (!value || !String(value).trim())) {
        return ok('Primary Reportee is required');
    }
    if (!value) return ok();
    const v = String(value).trim();
    if (employeeRecordId && v === String(employeeRecordId)) {
        return ok('Employee cannot be selected as their own reportee');
    }
    if (employeeEmployeeId && v === String(employeeEmployeeId)) {
        return ok('Employee cannot be selected as their own reportee');
    }
    return ok();
}

export function validateSecondaryReportee(value, { primaryReportee = '', employeeRecordId = '', employeeEmployeeId = '' } = {}) {
    if (!value) return ok();
    const v = String(value).trim();
    if (primaryReportee && v === String(primaryReportee).trim()) {
        return ok('Secondary Reportee cannot be the same as Primary Reportee');
    }
    if (employeeRecordId && v === String(employeeRecordId)) {
        return ok('Employee cannot be selected as their own reportee');
    }
    if (employeeEmployeeId && v === String(employeeEmployeeId)) {
        return ok('Employee cannot be selected as their own reportee');
    }
    return ok();
}

export function validateEmployeeWorkDetailsForm(form = {}, { employee = null, requireCompanyEmail = false } = {}) {
    const errors = {};
    const set = (field, result) => {
        if (!result.isValid) errors[field] = result.error;
    };
    const employeeRecordId = employee?._id || employee?.id || '';
    const employeeEmployeeId = employee?.employeeId || '';
    const dateOfBirth = employee?.dateOfBirth || '';

    set('companyEmail', validateCompanyEmail(form.companyEmail, { required: requireCompanyEmail }));
    set('dateOfJoining', validateDateOfJoining(form.dateOfJoining, { dateOfBirth }));
    const resolvedContractDate = resolveContractJoiningDate(employee);
    const contractFromVisa = Boolean(resolveFirstVisaIssueDate(employee));
    if (!resolvedContractDate) {
        errors.contractJoiningDate = 'Add Visa issue date — Contract Joining Date is set automatically from the first visa.';
    } else {
        set(
            'contractJoiningDate',
            validateContractJoiningDate(resolvedContractDate, form.dateOfJoining, { allowFuture: contractFromVisa }),
        );
    }
    set('company', validateWorkCompany(form.company));
    set('department', validateWorkDepartment(form.department));
    set('designation', validateWorkDesignation(form.designation));
    set('status', validateWorkStatus(form.status));
    set('reportingAuthority', validateReportingAuthority(form.reportingAuthority, { employeeRecordId, employeeEmployeeId }));
    set('primaryReportee', validatePrimaryReportee(form.primaryReportee, {
        employeeRecordId,
        employeeEmployeeId,
        department: form.department,
    }));
    set('secondaryReportee', validateSecondaryReportee(form.secondaryReportee, {
        primaryReportee: form.primaryReportee,
        employeeRecordId,
        employeeEmployeeId,
    }));

    if (form.enablePortalAccess === undefined || form.enablePortalAccess === null) {
        errors.enablePortalAccess = 'Portal Access is required';
    }
    if (form.overtime === undefined || form.overtime === null) {
        errors.overtime = 'Overtime selection is required';
    }

    return errors;
}

export function calculateRemainingProbation({ status, dateOfJoining, contractJoiningDate, probationPeriod = 6 }) {
    const startRef = contractJoiningDate || dateOfJoining;
    if (status !== 'Probation' || !startRef || !probationPeriod) return null;
    const startDate = parseIsoDate(startRef);
    if (!startDate) return null;
    startDate.setHours(0, 0, 0, 0);
    const probationEndDate = new Date(startDate);
    probationEndDate.setMonth(startDate.getMonth() + Number(probationPeriod));
    probationEndDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < startDate) {
        let diffMonths = (probationEndDate.getFullYear() - startDate.getFullYear()) * 12
            + (probationEndDate.getMonth() - startDate.getMonth());
        let diffDays = probationEndDate.getDate() - startDate.getDate();
        if (diffDays < 0) {
            diffMonths -= 1;
            const prevMonth = new Date(probationEndDate.getFullYear(), probationEndDate.getMonth(), 0);
            diffDays += prevMonth.getDate();
        }
        return { months: Math.max(0, diffMonths), days: Math.max(0, diffDays), isOver: false, notStarted: true };
    }

    if (today >= probationEndDate) return { months: 0, days: 0, isOver: true };
    let diffMonths = (probationEndDate.getFullYear() - today.getFullYear()) * 12
        + (probationEndDate.getMonth() - today.getMonth());
    let diffDays = probationEndDate.getDate() - today.getDate();
    if (diffDays < 0) {
        diffMonths -= 1;
        const prevMonth = new Date(probationEndDate.getFullYear(), probationEndDate.getMonth(), 0);
        diffDays += prevMonth.getDate();
    }
    return { months: Math.max(0, diffMonths), days: Math.max(0, diffDays), isOver: false };
}

export function formatRemainingProbation(info) {
    if (!info) return null;
    if (info.isOver) return 'Completed';
    const parts = [];
    if (info.months > 0) parts.push(`${info.months} Month${info.months !== 1 ? 's' : ''}`);
    if (info.days > 0) parts.push(`${info.days} Day${info.days !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(' and ') : '0 Days';
}
