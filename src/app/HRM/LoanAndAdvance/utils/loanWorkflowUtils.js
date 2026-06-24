export const LOAN_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'System' },
    { id: 2, label: 'Requester', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
];

export function getLoanStatusStepId(loan) {
    const status = loan?.approvalStatus || loan?.status;
    const map = {
        Draft: 2,
        Pending: 3,
        'Pending HR': 3,
        'Pending Accounts': 4,
        'Pending Authorization': 5,
        Approved: 6,
        Paid: 6,
    };
    return map[status] || 2;
}

export function isLoanWorkflowStepApproved(step, loan, workflow = []) {
    const status = loan?.approvalStatus || loan?.status;
    if (['Approved', 'Paid'].includes(status)) return true;
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
    const nextId = step.id + 1;
    if (nextId === 2) return String(status || '').toLowerCase() !== 'draft';
    if (nextId === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (nextId === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (nextId === 5) {
        return (
            workflow.some(
                (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
            ) || ['Approved', 'Paid'].includes(status)
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

export function getLoanStepActor(step, loan, workflow = []) {
    if (step.id === 1) return 'System';
    if (step.id === 2) {
        const creator = loan.createdBy;
        if (!creator) return loan.applicantName || 'Requester';
        return (
            creator.name ||
            (creator.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : 'Requester')
        );
    }
    if (step.id === 3) {
        const hrStep = workflow.find((w) => w.role === 'HR');
        if (hrStep?.assignedTo?.firstName) {
            return `${hrStep.assignedTo.firstName} ${hrStep.assignedTo.lastName || ''}`.trim();
        }
        if (loan.hrHODName && loan.hrHODName !== 'Unknown') return loan.hrHODName;
        return 'HR Manager';
    }
    if (step.id === 4) {
        const accStep = workflow.find((w) => w.role === 'Accounts');
        if (accStep?.assignedTo?.firstName) {
            return `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim();
        }
        if (loan.accountsHODName && loan.accountsHODName !== 'Unknown') return loan.accountsHODName;
        return 'Accounts Officer';
    }
    if (step.id === 5) {
        const mgtStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        if (mgtStep?.assignedTo?.firstName) {
            return `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim();
        }
        if (loan.approvedBy) {
            return (
                loan.approvedBy.name ||
                (loan.approvedBy.firstName
                    ? `${loan.approvedBy.firstName} ${loan.approvedBy.lastName || ''}`.trim()
                    : '')
            );
        }
        if (loan.ceoName && loan.ceoName !== 'Unknown') return loan.ceoName;
        return 'CEO / Management';
    }
    return '';
}

export function getLoanStepDateStr(step, loan, workflow = [], format) {
    let dateValue = null;
    if (step.id <= 2) {
        dateValue = loan.createdAt;
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
