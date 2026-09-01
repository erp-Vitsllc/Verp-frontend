import { toCalendarMonthDay, toPayrollMonthDay } from './payrollMonthDay';

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
    { key: 'allUnauthorizedLeave', label: 'Unauthorized attendance for annual leave' },
    { key: 'pendingLeaveApproval', label: 'Pending leave approval' },
];

export const HR_RULE_CHECKS = [
    { key: 'advance', label: 'Pending Salary Advance' },
    { key: 'fine', label: 'Pending Fine' },
    { key: 'utilityBill', label: 'Pending Utility Bill' },
    { key: 'salikExcess', label: 'Pending Salik Excess' },
    { key: 'loan', label: 'Pending Loan' },
    { key: 'reward', label: 'Pending Reward' },
    { key: 'sandwichLeave', label: 'Sandwich leave applicable on salary' },
    { key: 'allowedSickLeavePerYear', label: 'Allowed sick leave per year' },
];

/** Days before the salary processing date (1st of the month by default). */
export const REMINDER_DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => String(i + 1));

/** On-the-day email after 1st / 2nd / 3rd reminders. */
export const PROCESSING_DAY_REMINDER_INDEX = 3;

export function reminderDayCount(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 0;
}

export function chainedReminderDayOptions(reminders, index) {
    if (index === PROCESSING_DAY_REMINDER_INDEX) return [];
    if (index <= 0) return REMINDER_DAY_OPTIONS;
    const prev = reminderDayCount(reminders?.[index - 1]?.daysBefore);
    if (index === 1) {
        if (prev < 2) return [];
        return Array.from({ length: prev - 1 }, (_, i) => String(i + 1));
    }
    if (prev < 1) return [];
    return Array.from({ length: prev }, (_, i) => String(i + 1));
}

export function clampChainedReminderDays(rows) {
    const next = (Array.isArray(rows) ? rows : []).map((row) => ({ ...row }));
    const allowedSecond = new Set(chainedReminderDayOptions(next, 1));
    if (next[1] && !allowedSecond.has(String(next[1].daysBefore || ''))) {
        next[1] = { ...next[1], daysBefore: '' };
    }
    const allowedThird = new Set(chainedReminderDayOptions(next, 2));
    if (next[2] && !allowedThird.has(String(next[2].daysBefore || ''))) {
        next[2] = { ...next[2], daysBefore: '' };
    }
    if (next[PROCESSING_DAY_REMINDER_INDEX]) {
        next[PROCESSING_DAY_REMINDER_INDEX] = {
            ...next[PROCESSING_DAY_REMINDER_INDEX],
            daysBefore: 0,
        };
    }
    return next;
}
export const REMINDER_FOR_WHOM_OPTIONS = [
    { value: 'wfAccounts', label: 'WF Accounts' },
    { value: 'wfHr', label: 'WF HR' },
    { value: 'wfAdmin', label: 'WF Admin' },
    { value: 'wfManagement', label: 'WF Management' },
    { value: 'pendingTaskUser', label: 'Pending task user' },
];

const REMINDER_AUDIENCE_KEYS = new Set(REMINDER_FOR_WHOM_OPTIONS.map((row) => row.value));
const LEGACY_REMINDER_AUDIENCE = {
    accounts: 'wfAccounts',
    hr: 'wfHr',
    pendingEmployee: 'pendingTaskUser',
    primaryReportee: 'pendingTaskUser',
};

export function normalizeReminderAudiences(value) {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return [
        ...new Set(
            items
                .map((item) => {
                    const raw = String(item || '').trim();
                    if (REMINDER_AUDIENCE_KEYS.has(raw)) return raw;
                    return LEGACY_REMINDER_AUDIENCE[raw] || '';
                })
                .filter(Boolean),
        ),
    ];
}
export const REMINDER_LABELS = [
    'Salary process 1st reminder',
    '2nd reminder',
    '3rd reminder',
    'Salary processing',
];

const RULE_KEYS = [
    'allAttendanceMarked',
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
    salaryProcessingDate: '1',
    salaryProcessStartMonth: '',
    salaryCutoffDate: '',
    processingRules: { ...EMPTY_RULES },
    workingDaysRequiredToEligible: '',
    leaveSalaryWorkingDays: '',
    workingDaysRequiredForAirTicket: '',
    authorizedLeaveDeductionDays: '',
    unauthorizedLeaveDeductionDays: '',
    allowedSickLeaveDaysPerYear: '',
    lateInRules: [{ minutes: '', events: '', deduct: '' }],
    lateOutRules: [{ minutes: '', events: '', deduct: '' }],
    extraLateRules: [],
    salaryProcessReminders: [
        { daysBefore: '', forWhom: [] },
        { daysBefore: '', forWhom: [] },
        { daysBefore: '', forWhom: [] },
        { daysBefore: 0, forWhom: [] },
    ],
    attachment: { ...EMPTY_POLICY_ATTACHMENT },
};

export function emptyLateRule() {
    return { minutes: '', events: '', deduct: '' };
}

export function emptyExtraLateRule() {
    return { title: '', minutes: '', events: '', deduct: '' };
}

export function toLateRuleRows(value) {
    if (!Array.isArray(value) || value.length === 0) return [emptyLateRule()];
    return value.map((row) => ({
        minutes: row?.minutes ?? '',
        events: row?.events ?? '',
        deduct: row?.deduct || '',
    }));
}

export function toSingleLateRuleRow(value) {
    return [toLateRuleRows(value)[0]];
}

export function toExtraLateRuleRows(value) {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.map((row) => ({
        title: row?.title || '',
        minutes: row?.minutes ?? '',
        events: row?.events ?? '',
        deduct: row?.deduct || '',
    }));
}

export function toReminderRows(value) {
    const rows = Array.isArray(value) ? value : [];
    return [0, 1, 2, PROCESSING_DAY_REMINDER_INDEX].map((index) => ({
        daysBefore: index === PROCESSING_DAY_REMINDER_INDEX ? 0 : (rows[index]?.daysBefore ?? ''),
        forWhom: normalizeReminderAudiences(rows[index]?.forWhom),
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
        salaryProcessingDate: toPayrollMonthDay(data?.salaryProcessingDate) || '1',
        salaryProcessStartMonth: data?.salaryProcessStartMonth || '',
        salaryCutoffDate: toCalendarMonthDay(data?.salaryCutoffDate),
        processingRules: { ...EMPTY_RULES, ...(data?.processingRules || {}) },
        workingDaysRequiredToEligible: data?.workingDaysRequiredToEligible ?? '',
        leaveSalaryWorkingDays: data?.leaveSalaryWorkingDays ?? '',
        workingDaysRequiredForAirTicket: data?.workingDaysRequiredForAirTicket ?? '',
        authorizedLeaveDeductionDays: data?.authorizedLeaveDeductionDays ?? '',
        unauthorizedLeaveDeductionDays: data?.unauthorizedLeaveDeductionDays ?? '',
        allowedSickLeaveDaysPerYear: data?.allowedSickLeaveDaysPerYear ?? '',
        lateInRules: toSingleLateRuleRow(data?.lateInRules),
        lateOutRules: toSingleLateRuleRow(data?.lateOutRules),
        extraLateRules: toExtraLateRuleRows(data?.extraLateRules),
        salaryProcessReminders: toReminderRows(data?.salaryProcessReminders),
        attachment: toPolicyAttachment(data?.attachment),
    };
}
