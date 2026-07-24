export const LOAN_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'System' },
    { id: 2, label: 'Requester', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
    { id: 6, label: 'Paid to Employee', role: 'Paid to Employee' },
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
        'Pending Payment to Employee': 6,
        Paid: 6,
    };
    return map[status] || 2;
}

export function isLoanWorkflowStepApproved(step, loan, workflow = []) {
    const status = loan?.approvalStatus || loan?.status;

    // Step 6 completes only when Accounts has disbursed (status Paid)
    if (step.id === 6) {
        return (
            status === 'Paid' ||
            workflow.some((w) => w.role === 'Paid to Employee' && w.status === 'Approved')
        );
    }

    if (status === 'Paid') return true;
    if (status === 'Approved' || status === 'Pending Payment to Employee') {
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
    const postMgt = ['Approved', 'Pending Payment to Employee', 'Paid'].includes(status);
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
    if (step.id === 6) {
        const payStep = workflow.find((w) => w.role === 'Paid to Employee');
        if (payStep?.assignedTo?.firstName) {
            return `${payStep.assignedTo.firstName} ${payStep.assignedTo.lastName || ''}`.trim();
        }
        if (loan.accountsHODName && loan.accountsHODName !== 'Unknown') return loan.accountsHODName;
        return 'Accounts Officer';
    }
    return '';
}

export function getLoanStepDateStr(step, loan, workflow = [], format) {
    let dateValue = null;
    if (step.id <= 2) {
        dateValue = loan.createdAt;
    } else if (step.id === 6) {
        const payStep = workflow.find(
            (w) => w.role === 'Paid to Employee' && w.status === 'Approved',
        );
        dateValue = payStep?.actionedAt || (loan.approvalStatus === 'Paid' ? loan.updatedAt : null);
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
