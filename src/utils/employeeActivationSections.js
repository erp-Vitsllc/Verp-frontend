import { isAdmin } from '@/utils/permissions';

function normalizeEmployeeIdCompare(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function portalUserActorIds(currentUser) {
    const ids = new Set();
    if (!currentUser) return ids;
    const emp = String(
        currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
    ).trim();
    if (emp) ids.add(emp);
    const uid = String(currentUser._id || currentUser.id || '').trim();
    if (uid) ids.add(uid);
    return ids;
}

function portalUserMatchesStoredId(currentUser, storedId) {
    const target = String(storedId || '').trim();
    if (!target) return false;
    return portalUserActorIds(currentUser).has(target);
}

/** Portal user viewing their own employee profile record. */
export function viewerIsEmployeeProfileSubject(employee, currentUser) {
    if (!employee || !currentUser) return false;
    const profObj = String(employee._id || '');
    const myObj = String(
        currentUser.employeeObjectId || currentUser.empObjectId || currentUser.linkedEmployee || '',
    );
    const profEidNorm = normalizeEmployeeIdCompare(employee.employeeId);
    const myEidNorm = normalizeEmployeeIdCompare(currentUser.employeeId);
    const myUserId = String(currentUser._id || currentUser.id || '').trim();

    if (profObj && myObj && profObj === myObj) return true;
    if (profEidNorm && myEidNorm && profEidNorm === myEidNorm) return true;
    if (myUserId && profObj && myUserId === profObj) return true;

    const emails = new Set(
        [employee.email, employee.workEmail, employee.companyEmail, employee.personalEmail]
            .map((e) => String(e || '').toLowerCase().trim())
            .filter(Boolean),
    );
    const myEmails = [currentUser.email, currentUser.workEmail, currentUser.companyEmail, currentUser.personalEmail]
        .map((e) => String(e || '').toLowerCase().trim())
        .filter(Boolean);
    if (emails.size && myEmails.some((m) => emails.has(m))) return true;

    return false;
}

export function viewerIsProfileActivationDraftEditor(employee, currentUser) {
    if (!employee || !currentUser) return false;
    return portalUserMatchesStoredId(currentUser, employee.profileActivationDraftEditor);
}

/** User who submitted (or is editing before first submit) for activation / reactivation. */
export function viewerIsProfileActivationSubmitter(employee, currentUser) {
    if (!employee || !currentUser) return false;
    if (!isEmployeeProfileApprovalSubmitted(employee)) {
        if (viewerIsEmployeeProfileSubject(employee, currentUser)) return true;
        if (viewerIsProfileActivationDraftEditor(employee, currentUser)) return true;
    }
    const sid = employee.profileActivationSubmittedBy;
    if (sid && portalUserMatchesStoredId(currentUser, sid)) return true;
    if (!sid) return viewerIsEmployeeProfileSubject(employee, currentUser);
    return false;
}

/** Profile subject, activation submitter, or user who queued draft changes. */
export function viewerCanManageEmployeeActivationDraft(employee, currentUser) {
    if (!employee || !currentUser) return false;
    return (
        viewerIsEmployeeProfileSubject(employee, currentUser) ||
        viewerIsProfileActivationSubmitter(employee, currentUser) ||
        viewerIsProfileActivationDraftEditor(employee, currentUser)
    );
}

/** Who may open Send for Activation — includes HR with activation create on first-time inactive profiles. */
export function viewerCanSubmitEmployeeProfileActivation(
    employee,
    currentUser,
    { canCreateActivation = false } = {},
) {
    if (!employee || !currentUser) return false;
    if (viewerCanManageEmployeeActivationDraft(employee, currentUser)) return true;
    const profileStatus = String(employee.profileStatus || 'inactive').toLowerCase();
    if (profileStatus === 'inactive' && !isEmployeeProfileLiveActive(employee) && canCreateActivation) {
        return true;
    }
    return false;
}

export function isEmployeeProfileApprovalSubmitted(employee) {
    return String(employee?.profileApprovalStatus || 'draft').toLowerCase() === 'submitted';
}

/**
 * Pending queue UI (badges, proposed overlays, hold modal): draft = submitter/subject only;
 * after Send for Activation, HR reviewers and admins may also see.
 */
export function canViewerSeeEmployeePendingActivationQueue(
    employee,
    currentUser,
    { canReviewProfileActivation = false } = {},
) {
    if (!employee || !currentUser) return false;
    const isSubmitter = viewerIsProfileActivationSubmitter(employee, currentUser);
    const isSubject = viewerIsEmployeeProfileSubject(employee, currentUser);
    if (isEmployeeProfileApprovalSubmitted(employee)) {
        return canReviewProfileActivation || isAdmin() || isSubmitter || isSubject;
    }
    return isSubmitter || isSubject || viewerIsProfileActivationDraftEditor(employee, currentUser);
}

/** HR / admin may open activation review only after the employee has submitted. */
export function canViewerReviewEmployeeActivationAsHr(employee, { canReviewProfileActivation = false } = {}) {
    if (!canReviewProfileActivation && !isAdmin()) return false;
    return isEmployeeProfileApprovalSubmitted(employee);
}

/** Pending rows visible to the current viewer (empty when draft and viewer is not submitter/subject). */
export function employeePendingChangesForViewer(employee, canSeePending) {
    if (!canSeePending) return [];
    return Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
}

/** True when profile has queued changes waiting for activation / reactivation submit. */
export function hasEmployeeActivationQueue(employee) {
    return (
        Array.isArray(employee?.pendingReactivationChanges) &&
        employee.pendingReactivationChanges.length > 0
    );
}

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

const hasVisaNumber = (value) => Boolean(String(value || '').trim());

const isVisitVisaTypeKey = (type) => {
    const normalized = String(type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized === 'visit' || normalized === 'visiting';
};

/** Emirates ID / Labour Card / Bank Details are optional only for visit-visa-only employees (no employment/spouse visa). */
export function employeeRequiresEmiratesId(employee = {}, pendingVisa = null) {
    const visaDetails = employee?.visaDetails || {};
    if (hasVisaNumber(visaDetails.employment?.number) || hasVisaNumber(visaDetails.spouse?.number)) {
        return true;
    }
    if (hasVisaNumber(visaDetails.visit?.number)) {
        return false;
    }
    const pendingType = pendingVisa?.visaType || pendingVisa?.type || '';
    if (hasVisaNumber(pendingVisa?.number)) {
        return !isVisitVisaTypeKey(pendingType);
    }
    return true;
}

export const employeeRequiresLabourCard = employeeRequiresEmiratesId;

export const employeeRequiresBankDetails = employeeRequiresEmiratesId;

/** HR has fully activated this profile — profileStatus must not demote to inactive. */
export function hasEmployeeProfileEverBeenActivated(employee) {
    const profileStatus = String(employee?.profileStatus || 'inactive').toLowerCase();
    if (profileStatus === 'active') return true;
    const profileApprovalStatus = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
    if (profileApprovalStatus === 'active') return true;
    const workflow = Array.isArray(employee?.profileWorkflow) ? employee.profileWorkflow : [];
    return workflow.some((step) => String(step?.status || '').toLowerCase() === 'active');
}

/** Show Active tag / live-profile UX — not tied to progress bar completion %. */
export function isEmployeeProfileActivated(employee) {
    return hasEmployeeProfileEverBeenActivated(employee);
}

/** Profile is active in workflow (status or approval). Prefer live-active for UI gates. */
export function isEmployeeProfileActive(employee) {
    const profileStatus = String(employee?.profileStatus || 'inactive').toLowerCase();
    const profileApprovalStatus = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
    return profileStatus === 'active' || profileApprovalStatus === 'active';
}

/** HR-activated employee — profileStatus stays active; approval may be draft/submitted during reactivation. */
export function isEmployeeProfileStatusActive(employee) {
    return String(employee?.profileStatus || 'inactive').toLowerCase() === 'active';
}

/** No pending HR approval — live writes queue only when both status fields are active. */
export function isEmployeeProfileLiveActive(employee) {
    const profileStatus = String(employee?.profileStatus || 'inactive').toLowerCase();
    const profileApprovalStatus = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
    return profileStatus === 'active' && profileApprovalStatus === 'active';
}

/** Renew / Not Renew — any HR-activated profile (same rule as Active badge). */
export function canShowEmployeeRenewNotRenew(employee) {
    if (String(employee?.status || '').trim() === 'Left User') return false;
    return isEmployeeProfileActivated(employee);
}

/** Core profile cards — not deletable on active profiles; inactive profiles use permission chart (admin always). */
export const EMPLOYEE_NON_DELETABLE_PROFILE_SECTIONS = new Set([
    'workDetails',
    'personal',
    'permanentAddress',
    'currentAddress',
    'emergencyContact',
    'bank',
    'salary',
]);

export function isNonDeletableEmployeeProfileSection(sectionKey) {
    return EMPLOYEE_NON_DELETABLE_PROFILE_SECTIONS.has(sectionKey);
}

/**
 * Delete visibility:
 * - Live-active profile → Super User only (document cards; core profile cards stay edit-only).
 * - Inactive / building profile → users with delete permission in their group.
 */
export function canDeleteEmployeeCard(employee, hasDeletePermission, sectionKey = null) {
    if (String(employee?.status || '').trim() === 'Left User') return false;
    if (isEmployeeProfileLiveActive(employee)) {
        if (sectionKey && isNonDeletableEmployeeProfileSection(sectionKey)) return false;
        return isAdmin();
    }
    return !!hasDeletePermission;
}

/** Old Documents tab rows (archived docs + closed salary history). */
export function canDeleteEmployeeOldDocumentRow(
    employee,
    { isSuperUser = false, hasOldDocDelete = false, hasSalaryDelete = false, isSalaryHistoryRow = false } = {},
) {
    if (String(employee?.status || '').trim() === 'Left User') return false;
    if (isEmployeeProfileLiveActive(employee)) return isSuperUser;
    if (isSalaryHistoryRow) return isSuperUser || hasSalaryDelete || hasOldDocDelete;
    return isSuperUser || hasOldDocDelete;
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

export function isPersonalDetailsPending(employee, canSeePending = true) {
    if (!canSeePending) return false;
    return employeeHasPendingChange(employee, {
        match: (change) => {
            if (normKey(change?.section) !== 'basicdetails') return false;
            const proposed = change?.proposedData || {};
            return Object.keys(proposed).some((key) => PERSONAL_DETAIL_FIELD_KEYS.has(key));
        },
    });
}

export function isSalaryDetailsPending(employee, canSeePending = true) {
    if (!canSeePending) return false;
    return employeeHasPendingChange(employee, { cardIncludes: 'salary' });
}

export function isBankDetailsPending(employee, canSeePending = true) {
    if (!canSeePending) return false;
    return employeeHasPendingChange(employee, { cardIncludes: 'bank' });
}

export function isEmergencyContactPending(employee, canSeePending = true) {
    if (!canSeePending) return false;
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

/** Toast copy when a change is stored in pendingReactivationChanges (not live yet). */
export function hrQueuedActivationToast(label = 'Change') {
    return {
        title: 'Queued for HR approval',
        description: `${label} is saved in the pending queue. The live profile is unchanged until HR approves (Send for Activation → HR review).`,
    };
}

/** After a queued save, keep live profile fields; only sync queue / workflow metadata from the API. */
export function mergeQueuedEmployeeApiResponse(prevEmployee, savedEmployee) {
    if (!savedEmployee) return prevEmployee;
    if (!prevEmployee) return savedEmployee;
    return {
        ...prevEmployee,
        pendingReactivationChanges:
            savedEmployee.pendingReactivationChanges ?? prevEmployee.pendingReactivationChanges,
        profileActivationHold: savedEmployee.profileActivationHold ?? prevEmployee.profileActivationHold,
        profileApprovalStatus: savedEmployee.profileApprovalStatus ?? prevEmployee.profileApprovalStatus,
        profileWorkflow: savedEmployee.profileWorkflow ?? prevEmployee.profileWorkflow,
        profileSubmittedTo: savedEmployee.profileSubmittedTo ?? prevEmployee.profileSubmittedTo,
        profileActivationSubmittedBy:
            savedEmployee.profileActivationSubmittedBy ?? prevEmployee.profileActivationSubmittedBy,
        profileActivationDraftEditor:
            savedEmployee.profileActivationDraftEditor ?? prevEmployee.profileActivationDraftEditor,
        // Salary increment archives to oldDocuments immediately on the server even when the live salary row is queued.
        oldDocuments: Array.isArray(savedEmployee.oldDocuments)
            ? savedEmployee.oldDocuments
            : prevEmployee.oldDocuments,
    };
}

/** After a queued card save, merge queue metadata from PATCH without refetch wiping pending rows. */
export function applyQueuedEmployeeSaveResponse(updateEmployeeOptimistically, response, isQueued = null) {
    if (!updateEmployeeOptimistically || !response?.data?.employee) return false;
    const queued =
        isQueued === true ||
        isQueued === false
            ? isQueued
            : isApiResponseQueuedForHr(response);
    if (!queued) return false;
    updateEmployeeOptimistically((prev) => mergeQueuedEmployeeApiResponse(prev, response.data.employee));
    return true;
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
