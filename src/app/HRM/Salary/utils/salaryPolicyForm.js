import { toPayrollMonthDay } from './payrollMonthDay';

export const ATTENDANCE_COMPLETION_CHECKS = [
    { key: 'pendingAttendanceApproval', label: 'Pending attendance approval' },
    { key: 'pendingOtApproval', label: 'Pending O/T approval' },
    { key: 'pendingAuthorizedLeaveApproval', label: 'Pending authorized leave approval' },
    { key: 'pendingUnauthorizedLeaveApproval', label: 'Pending unauthorized leave approval' },
    { key: 'pendingSickLeaveApproval', label: 'Pending sick leave approval' },
    {
        key: 'pendingLateEarlyCompoffAdjustment',
        label: 'Pending late / early attendance approval, compoff leave adjustment',
    },
];

export const HR_RULE_CHECKS = [
    { key: 'advance', label: 'Salary Advance' },
    { key: 'fine', label: 'Fine' },
    { key: 'utilityBill', label: 'Utility Bill' },
    { key: 'salikExcess', label: 'Salik Excess' },
    { key: 'loan', label: 'Loan' },
    { key: 'reward', label: 'Reward' },
    { key: 'sandwichLeave', label: 'Sandwich Leave' },
];

export const REMINDER_DAY_OPTIONS = ['5', '10', '20', '30'];
export const REMINDER_FOR_WHOM_OPTIONS = [
    { value: 'accounts', label: 'Accounts' },
    { value: 'pendingEmployee', label: 'Pending employee' },
    { value: 'primaryReportee', label: 'Primary reportee' },
    { value: 'hr', label: 'HR' },
];
export const REMINDER_LABELS = ['Salary process 1st reminder', '2nd reminder', '3rd reminder'];

const RULE_KEYS = [
    'allAttendanceMarked',
    'allUnauthorizedLeave',
    ...ATTENDANCE_COMPLETION_CHECKS.map((row) => row.key),
    ...HR_RULE_CHECKS.map((row) => row.key),
    'gratuityCalculationRequired',
];

export const EMPTY_RULES = RULE_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

export const EMPTY_POLICY_ATTACHMENT = {
    name: '',
    mimeType: '',
    url: '',
    publicId: '',
    data: '',
    remove: false,
};

export const EMPTY_POLICY_FORM = {
    salaryProcessingDate: '',
    salaryProcessStartMonth: '',
    salaryCutoffDate: '',
    processingRules: { ...EMPTY_RULES },
    workingDaysRequiredToEligible: '',
    leaveSalaryWorkingDays: '',
    workingDaysRequiredForAirTicket: '',
    authorizedLeaveDeductionDays: '',
    unauthorizedLeaveDeductionDays: '',
    lateInRules: [{ minutes: '', events: '', deduct: '' }],
    lateOutRules: [{ minutes: '', events: '', deduct: '' }],
    salaryProcessReminders: [
        { daysBefore: '', forWhom: '' },
        { daysBefore: '', forWhom: '' },
        { daysBefore: '', forWhom: '' },
    ],
    attachment: { ...EMPTY_POLICY_ATTACHMENT },
};

export function emptyLateRule() {
    return { minutes: '', events: '', deduct: '' };
}

export function toLateRuleRows(value) {
    if (!Array.isArray(value) || value.length === 0) return [emptyLateRule()];
    return value.map((row) => ({
        minutes: row?.minutes ?? '',
        events: row?.events ?? '',
        deduct: row?.deduct || '',
    }));
}

export function toReminderRows(value) {
    const rows = Array.isArray(value) ? value : [];
    return [0, 1, 2].map((index) => ({
        daysBefore: rows[index]?.daysBefore ?? '',
        forWhom: rows[index]?.forWhom || '',
    }));
}

export function toPolicyAttachment(value) {
    if (!value || typeof value !== 'object') return { ...EMPTY_POLICY_ATTACHMENT };
    const name = String(value.name || '').trim();
    const publicId = String(value.publicId || '').trim();
    const url = String(value.url || '').trim();
    if (!name && !publicId && !url && !value.data) return { ...EMPTY_POLICY_ATTACHMENT };
    return {
        name,
        mimeType: String(value.mimeType || '').trim(),
        url,
        publicId,
        data: '',
        remove: false,
    };
}

export function policyFormFromApi(data) {
    return {
        salaryProcessingDate: toPayrollMonthDay(data?.salaryProcessingDate),
        salaryProcessStartMonth: data?.salaryProcessStartMonth || '',
        salaryCutoffDate: toPayrollMonthDay(data?.salaryCutoffDate),
        processingRules: { ...EMPTY_RULES, ...(data?.processingRules || {}) },
        workingDaysRequiredToEligible: data?.workingDaysRequiredToEligible ?? '',
        leaveSalaryWorkingDays: data?.leaveSalaryWorkingDays ?? '',
        workingDaysRequiredForAirTicket: data?.workingDaysRequiredForAirTicket ?? '',
        authorizedLeaveDeductionDays: data?.authorizedLeaveDeductionDays ?? '',
        unauthorizedLeaveDeductionDays: data?.unauthorizedLeaveDeductionDays ?? '',
        lateInRules: toLateRuleRows(data?.lateInRules),
        lateOutRules: toLateRuleRows(data?.lateOutRules),
        salaryProcessReminders: toReminderRows(data?.salaryProcessReminders),
        attachment: toPolicyAttachment(data?.attachment),
    };
}
