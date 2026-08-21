import {
    LOAN_PENDING_PAYMENT_STATUS,
    isLoanFullyDisbursed,
    isLoanPostManagementStatus,
} from './loanStatusConstants';

export const LOAN_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'Creator' },
    { id: 2, label: 'Creator', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
    { id: 6, label: 'Paid to Employee', role: 'Paid to Employee' },
];

export function getLoanStatusStepId(loan) {
    const status = loan?.approvalStatus || loan?.status;
    if (isLoanFullyDisbursed(loan)) return 6;
    const map = {
        Draft: 2,
        Pending: 3,
        'Pending HR': 3,
        'Pending Accounts': 4,
        'Pending Authorization': 5,
        Approved: 6,
        [LOAN_PENDING_PAYMENT_STATUS]: 6,
        Paid: 6,
    };
    return map[status] || 2;
}

export function isLoanWorkflowStepApproved(step, loan, workflow = []) {
    const status = loan?.approvalStatus || loan?.status;

    // Step 6 completes when Accounts has disbursed (balance cleared / Paid to Employee approved)
    if (step.id === 6) {
        return (
            isLoanFullyDisbursed(loan) ||
            workflow.some((w) => w.role === 'Paid to Employee' && w.status === 'Approved')
        );
    }

    if (isLoanFullyDisbursed(loan) || status === 'Paid') return true;
    if (status === 'Approved' || status === LOAN_PENDING_PAYMENT_STATUS) {
        // Management done — steps 1–5 complete; step 6 still pending payment
        return step.id <= 5;
    }

    if (step.id === 1) return true;
    if (step.id === 2) return String(status || '').toLowerCase() !== 'draft';
    if (step.id === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (step.id === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (step.id === 5) {
        return workflow.some(
            (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
        );
    }
    return false;
}

export function isLoanWorkflowConnectorGreen(step, loan, workflow = []) {
    const status = loan?.approvalStatus || loan?.status;
    const postMgt = isLoanPostManagementStatus(status);
    const nextId = step.id + 1;
    if (nextId === 2) return String(status || '').toLowerCase() !== 'draft';
    if (nextId === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (nextId === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (nextId === 5) {
        return (
            workflow.some(
                (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
            ) || postMgt
        );
    }
    if (nextId === 6) {
        return (
            postMgt ||
            workflow.some(
                (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
            )
        );
    }
    return false;
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
    if (step.id === 1 || step.id === 2) return resolveCreatorName(loan);

    if (step.id === 3) {
        const hod = flowchartName(loan.hrHODName);
        if (hod) return hod;
        const hrStep = workflow.find((w) => w.role === 'HR' || w.role === 'HR Admin');
        return (
            resolvePersonName(loan.hrApprovedBy) ||
            resolvePersonName(hrStep?.assignedTo) ||
            'HR'
        );
    }
    if (step.id === 4) {
        const hod = flowchartName(loan.accountsHODName);
        if (hod) return hod;
        const accStep = workflow.find((w) => w.role === 'Accounts');
        return (
            resolvePersonName(loan.accountsApprovedBy) ||
            resolvePersonName(accStep?.assignedTo) ||
            'Accounts'
        );
    }
    if (step.id === 5) {
        const hod = flowchartName(loan.ceoName);
        if (hod) return hod;
        const mgtStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        return (
            resolvePersonName(loan.approvedBy) ||
            resolvePersonName(mgtStep?.assignedTo) ||
            'Management'
        );
    }
    if (step.id === 6) {
        const hod = flowchartName(loan.accountsHODName);
        if (hod) return hod;
        const payStep = workflow.find((w) => w.role === 'Paid to Employee');
        return resolvePersonName(payStep?.assignedTo) || 'Accounts';
    }
    return '';
}

export function getLoanStepDateStr(step, loan, workflow = [], format) {
    let dateValue = null;
    if (step.id <= 2) {
        dateValue = loan.createdAt;
    } else     if (step.id === 6) {
        const payStep = workflow.find(
            (w) => w.role === 'Paid to Employee' && w.status === 'Approved',
        );
        dateValue =
            payStep?.actionedAt ||
            (isLoanFullyDisbursed(loan) || loan.approvalStatus === 'Paid' ? loan.updatedAt : null);
    } else {
        const wfStep = workflow.find((w) => w.role === step.role && w.status === 'Approved');
        dateValue = wfStep?.actionedAt;
    }
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
