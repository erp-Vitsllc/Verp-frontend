function normalizeMongoId(value) {
    const s = String(value ?? '').trim().toLowerCase();
    return s;
}

function normalizeEmployeeCode(value) {
    return String(value ?? '').toLowerCase().replace(/\s+/g, '');
}

function collectViewerIdentityIds(viewer) {
    if (!viewer || typeof viewer !== 'object') return [];
    const ids = [
        viewer._id,
        viewer.id,
        viewer.employeeObjectId,
        viewer.empObjectId,
        viewer.linkedEmployee,
    ]
        .map(normalizeMongoId)
        .filter(Boolean);
    return [...new Set(ids)];
}

function collectQueuedIdentityIds(entry) {
    if (!entry || typeof entry !== 'object') return [];
    const ids = [entry.queuedByUserId, entry.queuedByEmployeeObjectId]
        .map(normalizeMongoId)
        .filter(Boolean);
    return [...new Set(ids)];
}

export function isCompanyHrActivationReviewer(viewer = null, { isDesignatedFlowchartHr = false, isAdminViewer = false } = {}) {
    if (isDesignatedFlowchartHr || isAdminViewer) return true;
    if (!viewer || typeof viewer !== 'object') return false;
    return (
        viewer.isAdmin === true ||
        viewer.isAdministrator === true ||
        String(viewer.employeeId || '').trim().toUpperCase() === 'VEGA-HR-0000'
    );
}

/** HR reviewers see every queued row while activation is with HR; on hold only the submitter sees corrections. */
export function viewerCanSeeCompanyPendingChange(
    entry,
    viewer = null,
    {
        isDesignatedFlowchartHr = false,
        isAdminViewer = false,
        activationStatus = '',
        activationSubmitterEmployeeObjectId = '',
    } = {},
) {
    const status = String(activationStatus || '').toLowerCase();

    if (status === 'hold') {
        const submitterId = normalizeMongoId(activationSubmitterEmployeeObjectId);
        const viewerIds = collectViewerIdentityIds(viewer);
        if (submitterId && viewerIds.includes(submitterId)) return true;
        return viewerOwnsPendingChange(entry, viewer);
    }

    if (
        isCompanyHrActivationReviewer(viewer, { isDesignatedFlowchartHr, isAdminViewer }) &&
        status === 'submitted'
    ) {
        return true;
    }
    return viewerOwnsPendingChange(entry, viewer);
}

/** Pending HR-queue row is visible only to the employee who saved it (not other users or HR). */
export function viewerOwnsPendingChange(entry, viewer = null) {
    if (!entry || !viewer || typeof viewer !== 'object') return false;

    const queuedIdentityIds = collectQueuedIdentityIds(entry);
    const queuedEmpCode = normalizeEmployeeCode(entry?.queuedByEmployeeId);
    if (queuedIdentityIds.length === 0 && !queuedEmpCode) return false;

    const viewerIdentityIds = collectViewerIdentityIds(viewer);
    if (queuedIdentityIds.some((id) => viewerIdentityIds.includes(id))) return true;

    const viewerEmpCode = normalizeEmployeeCode(viewer?.employeeId);
    if (queuedEmpCode && viewerEmpCode && queuedEmpCode === viewerEmpCode) return true;

    return false;
}

export function filterPendingChangesForViewer(changes = [], viewer = null, options = {}) {
    return (Array.isArray(changes) ? changes : []).filter((entry) =>
        viewerCanSeeCompanyPendingChange(entry, viewer, options),
    );
}

const HR_QUEUE_CARD_MARKERS = [
    'basic details',
    'trade license',
    'establishment card',
    'moa',
    'owner details',
    'owner passport',
    'owner emirates',
];

/** Pending rows that belong in Submit-for-approval / ! indicators. */
export function isHrQueuedPendingCard(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const card = String(entry?.card || entry?.reason || '').toLowerCase();
    return HR_QUEUE_CARD_MARKERS.some((marker) => card.includes(marker));
}

/** Attach editor identity to queue rows missing queuedBy (e.g. legacy saves stripped by schema). */
export function stampPendingChangesWithViewer(company, viewer) {
    if (!company || !viewer || typeof viewer !== 'object') return company;
    if (!Array.isArray(company.pendingReactivationChanges)) return company;

    const stamp = {
        queuedByUserId: String(viewer._id || viewer.id || '').trim(),
        queuedByEmployeeId: String(viewer.employeeId || '').trim(),
        queuedByEmployeeObjectId: String(viewer.employeeObjectId || viewer.empObjectId || '').trim(),
        queuedByName: String(viewer.name || viewer.email || '').trim(),
    };
    const hasStamp =
        stamp.queuedByUserId || stamp.queuedByEmployeeId || stamp.queuedByEmployeeObjectId;
    if (!hasStamp) return company;

    let changed = false;
    const pendingReactivationChanges = company.pendingReactivationChanges.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        const hasOwner = Boolean(
            String(entry.queuedByUserId || '').trim() ||
                String(entry.queuedByEmployeeId || '').trim() ||
                String(entry.queuedByEmployeeObjectId || '').trim(),
        );
        if (hasOwner) return entry;
        changed = true;
        return { ...entry, ...stamp };
    });

    return changed ? { ...company, pendingReactivationChanges } : company;
}
