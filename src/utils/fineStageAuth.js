const STATUS_ROLE_MAP = {
    'Pending HR': 'HR',
    'Pending Review': 'HR',
    'Pending Accounts': 'Accounts',
    'Pending Finance': 'Accounts',
    'Pending Authorization': 'Management',
    'Pending Management': 'Management',
};

function normalizeRole(role) {
    if (!role) return null;
    if (role === 'CEO') return 'Management';
    return role;
}

export function getExpectedRoleForFineStatus(fineStatus, workflow = []) {
    if (fineStatus === 'Pending') {
        const pending = (workflow || []).find((w) => w.status === 'Pending');
        return pending ? normalizeRole(pending.role) : 'HR';
    }
    return STATUS_ROLE_MAP[fineStatus] || null;
}

export function getPendingWorkflowStep(workflow = [], expectedRole = null) {
    const list = Array.isArray(workflow) ? workflow : [];
    if (expectedRole) {
        const roles =
            expectedRole === 'Management' ? ['Management', 'CEO'] : [expectedRole];
        return list.find((w) => w.status === 'Pending' && roles.includes(w.role)) || null;
    }
    return list.find((w) => w.status === 'Pending') || null;
}

function collectIdentityIds(value) {
    if (!value) return [];
    if (typeof value === 'string' || typeof value === 'number') {
        return [String(value)];
    }
    return [value._id, value.id, value.employeeObjectId, value.employeeId]
        .filter(Boolean)
        .map(String);
}

function identitiesMatch(a, b) {
    const aIds = collectIdentityIds(a);
    const bIds = collectIdentityIds(b);
    if (!aIds.length || !bIds.length) return false;
    return aIds.some((aid) => bIds.includes(aid));
}

function getFlowchartEmployeeIdForRole(fine, expectedRole) {
    if (!fine || !expectedRole) return null;
    if (expectedRole === 'HR') return fine.hrHODId || null;
    if (expectedRole === 'Accounts') return fine.accountsHODId || null;
    if (expectedRole === 'Management') return fine.ceoEmployeeId || null;
    return null;
}

/**
 * Current flowchart assignee OR stored workflow assignee may act (+ Admin).
 */
export function canUserActOnFineStage({ user, fine, isAdmin = false }) {
    if (!user || !fine) return false;
    if (isAdmin) return true;

    const workflow = fine.workflow || [];
    const expectedRole = getExpectedRoleForFineStatus(fine.fineStatus, workflow);
    const pendingStep = getPendingWorkflowStep(workflow, expectedRole);

    if (pendingStep?.assignedTo && identitiesMatch(user, pendingStep.assignedTo)) {
        return true;
    }

    const flowchartEmpId = getFlowchartEmployeeIdForRole(fine, expectedRole);
    if (flowchartEmpId && identitiesMatch(user, { employeeId: flowchartEmpId })) {
        return true;
    }

    if (!pendingStep && fine.submittedTo && identitiesMatch(user, fine.submittedTo)) {
        return true;
    }

    return false;
}
