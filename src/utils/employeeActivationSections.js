import { isAdmin } from '@/utils/permissions';

/** Mirrors backend EMPLOYEE_ACTIVATION_SECTION_KEYS — progress-bar mandatory cards that queue on active profiles. */
export const EMPLOYEE_ACTIVATION_SECTION_KEYS = new Set([
    'basicDetails',
    'passport',
    'visa',
    'emiratesId',
    'labourCard',
    'workDetails',
    'signature',
    'emergencyContact',
]);

export const EMPLOYEE_INFORMATIVE_SECTION_KEYS = new Set([
    'medicalInsurance',
    'drivingLicense',
    'documents',
    'education',
    'experience',
    'training',
]);

const normKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Renew / Not Renew on HR-approved or live-active profiles. */
export function isEmployeeProfileActive(employee) {
    const profileStatus = String(employee?.profileStatus || 'inactive').toLowerCase();
    const profileApprovalStatus = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
    return profileStatus === 'active' || profileApprovalStatus === 'active';
}

/** Fully activated profile — admin-only delete. */
export function isEmployeeProfileLiveActive(employee) {
    const profileStatus = String(employee?.profileStatus || 'inactive').toLowerCase();
    const profileApprovalStatus = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
    return profileStatus === 'active' && profileApprovalStatus === 'active';
}

/** Inactive/draft: permission delete. Live active: admin only. */
export function canDeleteEmployeeCard(employee, hasDeletePermission) {
    if (isEmployeeProfileLiveActive(employee)) return isAdmin();
    return Boolean(hasDeletePermission);
}

export function employeeHasPendingChange(employee, matchers = {}) {
    const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
    return list.some((change) => {
        const section = normKey(change?.section);
        const card = normKey(change?.card);
        if (matchers.section && section === normKey(matchers.section)) return true;
        if (matchers.cardIncludes && card.includes(normKey(matchers.cardIncludes))) return true;
        if (matchers.sectionIncludes && section.includes(normKey(matchers.sectionIncludes))) return true;
        if (typeof matchers.match === 'function') return matchers.match(change, { section, card });
        return false;
    });
}

const PERSONAL_DETAIL_FIELD_KEYS = new Set([
    'dateOfBirth',
    'maritalStatus',
    'numberOfDependents',
    'fathersName',
    'gender',
    'nationality',
    'country',
]);

export function isPersonalDetailsPending(employee) {
    return employeeHasPendingChange(employee, {
        match: (change) => {
            if (normKey(change?.section) !== 'basicdetails') return false;
            const proposed = change?.proposedData || {};
            return Object.keys(proposed).some((key) => PERSONAL_DETAIL_FIELD_KEYS.has(key));
        },
    });
}

export function isSalaryDetailsPending(employee) {
    return employeeHasPendingChange(employee, { cardIncludes: 'salary' });
}

export function isBankDetailsPending(employee) {
    return employeeHasPendingChange(employee, { cardIncludes: 'bank' });
}

export function isEmergencyContactPending(employee) {
    return employeeHasPendingChange(employee, { sectionIncludes: 'emergencycontact' });
}

export function isApiResponseQueuedForHr(response) {
    const msg = String(response?.data?.message || '').toLowerCase();
    return (
        response?.data?.queuedForHrApproval === true ||
        msg.includes('queued for hr activation approval') ||
        msg.includes('queued for activation approval')
    );
}

const normalizeSubmittedCardLabel = (label) =>
    String(label || '')
        .toLowerCase()
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim();

const parseRequestedChangesFromWorkflowStep = (step = {}) => {
    if (!step || typeof step !== 'object') return [];
    const desc = String(step.description || '').trim();
    if (desc) {
        for (const segment of desc.split('|').map((s) => s.trim())) {
            const inline = segment.match(/^Requested Changes:\s*(.+)$/i);
            if (inline?.[1]) {
                return inline[1]
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
        }
        const tail = desc.match(/Requested Changes:\s*(.+)$/i);
        if (tail?.[1]) {
            return tail[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }
    const text = `${step.description || ''} ${step.reason || ''} ${step.comment || ''}`;
    const match = text.match(/Requested Changes:\s*([^|]+?)(?:\s*\||\s*Type:|$)/i);
    if (match?.[1]) {
        return match[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
};

const submittedCardLabelMatchesPart = (part, submittedSet) => {
    if (!part || !submittedSet?.size) return false;
    if (submittedSet.has(part)) return true;
    for (const s of submittedSet) {
        if (s === part) return true;
        if (s.startsWith(`${part} `) || part.startsWith(`${s} `)) return true;
    }
    return false;
};

/** Card labels from the latest profile workflow step still in `submitted` status. */
export function resolveLatestProfileSubmissionLabels(profileWorkflow = []) {
    const list = Array.isArray(profileWorkflow) ? profileWorkflow : [];
    for (let i = list.length - 1; i >= 0; i--) {
        const step = list[i];
        if (String(step?.status || '').toLowerCase() !== 'submitted') continue;
        const labels = parseRequestedChangesFromWorkflowStep(step);
        if (labels.length) return labels;
    }
    return [];
}

export function pendingEntryIncludedInSubmittedCards(entry, submittedCardLabels = []) {
    if (!entry || typeof entry !== 'object') return false;
    if (!Array.isArray(submittedCardLabels) || submittedCardLabels.length === 0) return true;
    const submitted = new Set(submittedCardLabels.map(normalizeSubmittedCardLabel).filter(Boolean));
    if (!submitted.size) return true;
    const rawCard = String(entry?.card || entry?.reason || '').trim();
    const parts = rawCard
        .split(',')
        .map((s) => normalizeSubmittedCardLabel(s))
        .filter(Boolean);
    if (!parts.length) return false;
    return parts.some((part) => submittedCardLabelMatchesPart(part, submitted));
}

/** Pending rows HR reviews in the current submission — excludes local drafts not in this submit. */
export function filterProfilePendingInCurrentSubmission(pendingChanges = [], profileWorkflow = []) {
    const list = Array.isArray(pendingChanges) ? pendingChanges : [];
    const labels = resolveLatestProfileSubmissionLabels(profileWorkflow);
    if (!labels.length) return list;
    return list.filter((entry) => pendingEntryIncludedInSubmittedCards(entry, labels));
}
