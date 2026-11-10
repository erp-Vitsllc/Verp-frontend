import {
    isLoanFullyDisbursed,
    isLoanPostManagementStatus,
} from './loanStatusConstants';

export const LOAN_WORKFLOW_STEPS = [
    { id: 1, key: 'created', label: 'Created', role: 'Creator' },
    { id: 2, key: 'creator', label: 'Creator', role: 'Requester' },
    { id: 3, key: 'hr', label: 'HR', role: 'HR' },
    { id: 4, key: 'accounts-pay', label: 'Accounts', role: 'Accounts' },
    { id: 5, key: 'management', label: 'Management', role: 'Management' },
    { id: 6, key: 'paid', label: 'Paid to Employee', role: 'Paid to Employee' },
];

const LEGACY_STEP_KEY = {
    1: 'created',
    2: 'creator',
    3: 'hr',
    4: 'accounts-pay',
    5: 'management',
    6: 'paid',
};

function workflowRows(workflow) {
    return Array.isArray(workflow) ? workflow : [];
}

function accountsRows(workflow) {
    return workflowRows(workflow).filter((step) => step?.role === 'Accounts');
}

/** Normal creator: Accounts approves before HR, then Accounts fills payment. */
export function loanUsesAccountsOpening(loan) {
    if (loan?.skipAccountsApproval === true) return false;
    if (loan?.accountsFirst === true) return true;
    const workflow = workflowRows(loan?.workflow);
    if (accountsRows(workflow).some((step) => step.phase === 'opening')) return true;
    if (accountsRows(workflow).length >= 2) return true;
    const first = workflow.find((step) =>
        ['Accounts', 'HR', 'HR Admin'].includes(step?.role),
    );
    if (first?.role === 'Accounts') return true;
    if (workflow.length === 0) {
        const status = String(loan?.approvalStatus || loan?.status || 'Draft').trim();
        return status === 'Draft' || status === '';
    }
    return false;
}

export function getLoanWorkflowSteps(loan) {
    const opening = loanUsesAccountsOpening(loan);
    const skipAccounts = loan?.skipAccountsApproval === true;
    const steps = [
        { key: 'created', label: 'Created', role: 'Creator' },
        { key: 'creator', label: 'Creator', role: 'Requester' },
    ];
    if (opening) {
        steps.push({
            key: 'accounts-open',
            label: 'Accounts',
            role: 'Accounts',
            detail: 'Approve only',
        });
    }
    steps.push({ key: 'hr', label: 'HR', role: 'HR' });
    if (!skipAccounts) {
        steps.push({
            key: 'accounts-pay',
            label: 'Accounts',
            role: 'Accounts',
            detail: opening ? 'Fill payment' : '',
        });
    }
    steps.push({ key: 'management', label: 'Management', role: 'Management' });
    steps.push({ key: 'paid', label: 'Paid to Employee', role: 'Paid to Employee' });
    return steps.map((step, index) => ({ ...step, id: index + 1 }));
}

function keyOf(step) {
    return step?.key || LEGACY_STEP_KEY[step?.id] || '';
}

function stepId(loan, key) {
    return getLoanWorkflowSteps(loan).find((step) => step.key === key)?.id || 2;
}

function hrIsApproved(loan, workflow) {
    return (
        Boolean(loan?.hrApprovedBy) ||
        workflowRows(workflow).some(
            (step) =>
                (step?.role === 'HR' || step?.role === 'HR Admin') && step?.status === 'Approved',
        )
    );
}

function openingAccountsRow(loan, workflow) {
    const rows = accountsRows(workflow);
    return rows.find((step) => step.phase === 'opening') || (loanUsesAccountsOpening(loan) ? rows[0] : null);
}

function paymentAccountsRow(loan, workflow) {
    const rows = accountsRows(workflow);
    const tagged = rows.find((step) => step.phase === 'payment');
    if (tagged) return tagged;
    if (loanUsesAccountsOpening(loan)) return rows.length > 1 ? rows[1] : null;
    return rows[0] || null;
}

/** First Accounts step on a normal-employee loan: approve only, no payment fields. */
export function isLoanAccountsOpeningApproval(loan) {
    const status = String(loan?.approvalStatus || loan?.status || '').trim();
    if (status !== 'Pending Accounts') return false;
    if (!loanUsesAccountsOpening(loan)) return false;
    if (loan?.hrApprovedBy) return false;
    const workflow = Array.isArray(loan?.workflow) ? loan.workflow : [];
    return !workflow.some(
        (step) => (step?.role === 'HR' || step?.role === 'HR Admin') && step?.status === 'Approved',
    );
}

export function getLoanStatusStepId(loan) {
    const status = String(loan?.approvalStatus || loan?.status || '').trim();
    if (isLoanFullyDisbursed(loan)) return stepId(loan, 'paid');
    if (status === 'Rejected') {
        const rejected = workflowRows(loan?.workflow).find((step) => step?.status === 'Rejected');
        const role = rejected?.role;
        if (role === 'Accounts') {
            const opening = openingAccountsRow(loan, loan?.workflow);
            return rejected === opening || rejected?.phase === 'opening'
                ? stepId(loan, 'accounts-open')
                : stepId(loan, 'accounts-pay');
        }
        if (role === 'HR' || role === 'HR Admin') return stepId(loan, 'hr');
        if (role === 'Management' || role === 'CEO') return stepId(loan, 'management');
        if (role === 'Paid to Employee') return stepId(loan, 'paid');
        return stepId(loan, 'creator');
    }
    if (status.toLowerCase() === 'draft') return stepId(loan, 'creator');
    if (status === 'Pending' || status === 'Pending HR') return stepId(loan, 'hr');
    if (status === 'Pending Accounts') {
        return isLoanAccountsOpeningApproval(loan)
            ? stepId(loan, 'accounts-open')
            : stepId(loan, 'accounts-pay');
    }
    if (status === 'Pending Authorization') return stepId(loan, 'management');
    if (isLoanPostManagementStatus(loan)) return stepId(loan, 'paid');
    return stepId(loan, 'creator');
}

export function isLoanWorkflowStepApproved(step, loan, workflow = []) {
    const status = loan?.approvalStatus || loan?.status;
    const key = keyOf(step);

    if (key === 'paid') {
        return (
            isLoanFullyDisbursed(loan) ||
            workflowRows(workflow).some((row) => row.role === 'Paid to Employee' && row.status === 'Approved')
        );
    }
    if (key === 'created') return true;
    if (key === 'creator') return String(status || '').toLowerCase() !== 'draft';
    if (key === 'accounts-open') return openingAccountsRow(loan, workflow)?.status === 'Approved';
    if (key === 'hr') return hrIsApproved(loan, workflow);
    if (key === 'accounts-pay') {
        const row = paymentAccountsRow(loan, workflow);
        if (row?.status === 'Pending') return false;
        if (row?.status === 'Approved') return true;
        return Boolean(loan?.accountsApprovedBy);
    }
    if (key === 'management') {
        return (
            workflowRows(workflow).some(
                (row) => (row.role === 'Management' || row.role === 'CEO') && row.status === 'Approved',
            ) || isLoanPostManagementStatus(status)
        );
    }
    return false;
}

export function isLoanWorkflowConnectorGreen(step, loan, workflow = []) {
    const steps = getLoanWorkflowSteps(loan);
    const index = steps.findIndex((row) => row.key === keyOf(step));
    const next = index >= 0 ? steps[index + 1] : null;
    if (!next) return false;
    if (isLoanWorkflowStepApproved(next, loan, workflow)) return true;
    return getLoanStatusStepId(loan) === next.id;
}

function toTitleCase(value) {
    if (!value || typeof value !== 'string') return value || '';
    return value
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** User has `name`; EmployeeBasic has firstName/lastName. */
function resolvePersonName(person) {
    if (!person || typeof person !== 'object') return '';
    const named = String(person.name || '').trim();
    if (isUsableDisplayName(named)) return named;
    const full = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    return isUsableDisplayName(full) ? full : '';
}

function isUsableDisplayName(value) {
    const named = String(value || '').trim();
    if (!named) return false;
    if (/^(unknown|system|n\/a)$/i.test(named)) return false;
    if (/^[a-fA-F0-9]{24}$/.test(named)) return false;
    return true;
}

function flowchartName(value) {
    return isUsableDisplayName(value) ? String(value).trim() : '';
}

function resolveCreatorName(loan) {
    return resolvePersonName(loan?.createdBy) || 'Creator';
}

/**
 * Tracker names only — does not change who can approve.
 * HR / Accounts / Management / Paid must show flowchart people, not the
 * applicant, department HOD, or whoever clicked Approve (e.g. Super User).
 */
export function getLoanStepActor(step, loan, workflow = []) {
    const key = keyOf(step);
    if (key === 'created' || key === 'creator') return resolveCreatorName(loan);

    if (key === 'hr') {
        const hod = flowchartName(loan.hrHODName);
        if (hod) return hod;
        const hrStep = workflowRows(workflow).find((w) => w.role === 'HR' || w.role === 'HR Admin');
        return (
            resolvePersonName(loan.hrApprovedBy) ||
            resolvePersonName(hrStep?.assignedTo) ||
            'HR'
        );
    }
    if (key === 'accounts-open' || key === 'accounts-pay') {
        const hod = flowchartName(loan.accountsHODName);
        if (hod) return hod;
        const accStep = key === 'accounts-open'
            ? openingAccountsRow(loan, workflow)
            : paymentAccountsRow(loan, workflow);
        return (
            resolvePersonName(loan.accountsApprovedBy) ||
            resolvePersonName(accStep?.assignedTo) ||
            'Accounts'
        );
    }
    if (key === 'management') {
        const hod = flowchartName(loan.ceoName);
        if (hod) return hod;
        const mgtStep = workflowRows(workflow).find((w) => w.role === 'Management' || w.role === 'CEO');
        return (
            resolvePersonName(loan.approvedBy) ||
            resolvePersonName(mgtStep?.assignedTo) ||
            'Management'
        );
    }
    if (key === 'paid') {
        const hod = flowchartName(loan.accountsHODName);
        if (hod) return hod;
        const payStep = workflowRows(workflow).find((w) => w.role === 'Paid to Employee');
        return resolvePersonName(payStep?.assignedTo) || 'Accounts';
    }
    return '';
}

export function getLoanStepDate(step, loan, workflow = []) {
    const key = keyOf(step);
    if (key === 'created' || key === 'creator') return loan?.createdAt || null;
    if (key === 'accounts-open') return openingAccountsRow(loan, workflow)?.actionedAt || null;
    if (key === 'hr') {
        return (
            workflowRows(workflow).find(
                (row) => (row.role === 'HR' || row.role === 'HR Admin') && row.status === 'Approved',
            )?.actionedAt || null
        );
    }
    if (key === 'accounts-pay') return paymentAccountsRow(loan, workflow)?.actionedAt || null;
    if (key === 'management') {
        const mgtStep = workflowRows(workflow).find(
            (row) => (row.role === 'Management' || row.role === 'CEO') && row.status === 'Approved',
        );
        return loan?.approvedDate || mgtStep?.actionedAt || null;
    }
    if (key === 'paid') {
        const payStep = workflowRows(workflow).find(
            (row) => row.role === 'Paid to Employee' && row.status === 'Approved',
        );
        return (
            payStep?.actionedAt ||
            (isLoanFullyDisbursed(loan) || loan?.approvalStatus === 'Paid' ? loan?.updatedAt : null)
        );
    }
    return null;
}

export function getLoanStepDateStr(step, loan, workflow = [], format) {
    const dateValue = getLoanStepDate(step, loan, workflow);
    if (dateValue && format) {
        try {
            return format(new Date(dateValue), 'MMM d, yyyy - hh:mm a');
        } catch {
            return null;
        }
    }
    return null;
}

export { toTitleCase };
