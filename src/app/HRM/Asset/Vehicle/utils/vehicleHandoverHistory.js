import {
    formatHandoverEscalationDayLabel,
    getHandoverEscalationDayInfo,
} from './vehicleHandoverEscalationUi';

const HANDOVER_HISTORY_ACTIONS = new Set([
    'Assigned',
    'Returned',
    'Unassigned',
    'Accepted',
    'Rejected',
    'ControllerHandover',
    'Transfer',
]);

const HANDOVER_ACTIONS_REQUIRING_ASSIGNEE = new Set([
    'Assigned',
    'Accepted',
    'Transfer',
    'ControllerHandover',
    'Rejected',
]);

const STATUS_SORT_ORDER = { incomplete: 0, pending: 1, accepted: 2, approved: 3, rejected: 4 };

const STATUS_PENDING = {
    key: 'pending',
    label: 'Pending',
    className: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_ACCEPTED = {
    key: 'accepted',
    label: 'Accepted',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
};

const STATUS_APPROVED = {
    key: 'approved',
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const STATUS_REJECTED = {
    key: 'rejected',
    label: 'Rejected',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
};

const STATUS_INCOMPLETE = {
    key: 'incomplete',
    label: 'Not Complete',
    className: 'bg-orange-50 text-orange-800 border border-orange-200',
};

function hasHandoverAssignee(entry) {
    if (String(entry?.assignedToType || '').toLowerCase() === 'company' && entry?.assignedCompany) {
        return true;
    }
    if (entry?.assignedTo) return true;

    const details = entry?.details || {};
    if (String(details.assignedToType || '').toLowerCase() === 'company' && details.assignedCompany) {
        return true;
    }
    return Boolean(details.assignedTo);
}

export function fmtHandoverPerson(person) {
    if (!person) return '';
    const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    return name || person.employeeId || '';
}

export function fmtHandoverCompany(company) {
    if (!company) return '';
    if (typeof company === 'object') return company.name || company.companyId || '';
    return String(company);
}

function formatHandoverActorLabel(stage, person) {
    const name = String(stage?.actorName || '').trim() || fmtHandoverPerson(person);
    const empId = String(stage?.actorEmployeeId || person?.employeeId || '').trim();
    if (name && empId) return `${name} (${empId})`;
    return name || empId || '—';
}

export function isVehicleInspectionHandoverEntry(entry, vehicle = null) {
    if (String(entry?.details?.handoverKind || '').trim() === 'vehicle_inspection') {
        return true;
    }
    if (entry?.details?.firstInspection === true) {
        return true;
    }
    const linkedId = vehicle?.vehicleInspectionHandoverHistoryId;
    if (linkedId && entry?._id && String(linkedId) === String(entry._id)) {
        return true;
    }
    const inspStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    if (
        (inspStatus === 'draft' || inspStatus === 'pending_hr') &&
        entry?._id &&
        linkedId &&
        String(linkedId) === String(entry._id)
    ) {
        return true;
    }
    return false;
}

export function isVehicleReturnHandoverEntry(entry, vehicle = null) {
    if (String(entry?.details?.handoverKind || '').trim() === 'vehicle_return') {
        return true;
    }
    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    if (flow?.isReturn && flow?.historyId && entry?._id && String(flow.historyId) === String(entry._id)) {
        return true;
    }
    return false;
}

export function isHandoverHistoryEntry(entry) {
    const action = String(entry?.action || '').trim();
    if (!HANDOVER_HISTORY_ACTIONS.has(action)) return false;
    if (HANDOVER_ACTIONS_REQUIRING_ASSIGNEE.has(action) && !hasHandoverAssignee(entry)) {
        return false;
    }
    return true;
}

function resolveFleetHandoverLifecycle(entry, vehicle) {
    const action = String(entry?.action || '').trim();
    const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();
    if (lifecycle === 'approved' || lifecycle === 'accepted' || lifecycle === 'pending' || lifecycle === 'rejected') {
        return lifecycle;
    }

    if (action === 'Returned' || action === 'Unassigned') {
        const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
        const isLinkedReturn =
            action === 'Returned' &&
            flow?.isReturn &&
            flow?.historyId &&
            entry?._id &&
            String(flow.historyId) === String(entry._id);
        if (isLinkedReturn) {
            const stage = String(flow.stage || '').toLowerCase();
            if (stage === 'hr' || stage === 'management' || stage === 'hod') return 'accepted';
            return 'pending';
        }
        if (lifecycle) return lifecycle;
        return 'approved';
    }

    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    const isLinked =
        flow?.historyId && entry?._id && String(flow.historyId) === String(entry._id);

    if (isLinked) {
        const stage = String(flow.stage || '').toLowerCase();
        if (stage === 'hr' || stage === 'management' || stage === 'hod') return 'accepted';
        return 'pending';
    }

    if (action === 'Accepted') return 'approved';

    if (action === 'Assigned') {
        if (String(entry?.details?.acceptanceStatus || '').trim() === 'Accepted') {
            return 'accepted';
        }
        return 'pending';
    }

    return 'pending';
}

function readFrozenHandoverLabel(entry, field, fallback) {
    const frozen = entry?.details?.[field];
    if (frozen !== undefined && frozen !== null && String(frozen).trim() !== '') {
        return String(frozen).trim();
    }
    return fallback;
}

export function getHandoverDisplayStatus(entry, vehicle = null) {
    const action = String(entry?.action || '').trim();
    const asset = vehicle || (entry?.isLive && entry?.details ? entry.details : null);

    if (isVehicleInspectionHandoverEntry(entry, asset)) {
        if (action === 'Rejected' || entry?.details?.acceptanceStatus === 'Rejected') {
            return STATUS_REJECTED;
        }
        if (action === 'Accepted' || entry?.details?.acceptanceStatus === 'Accepted') {
            return STATUS_APPROVED;
        }
        const linkedId = asset?.vehicleInspectionHandoverHistoryId;
        const inspStatus = String(asset?.vehicleInspectionStatus || '').toLowerCase();
        const formStatus = String(entry?.details?.inspectionFormStatus || '').toLowerCase();
        const isLinkedRow = linkedId && String(linkedId) === String(entry._id);

        if (isLinkedRow && inspStatus === 'draft') {
            const assessmentDone =
                entry?.details?.receiverAssessmentCompleted === true ||
                String(entry?.details?.inspectionFormStatus || '').toLowerCase() === 'complete';
            if (assessmentDone) return STATUS_PENDING;
            return STATUS_INCOMPLETE;
        }
        if (isLinkedRow && inspStatus === 'pending_hr') {
            return STATUS_PENDING;
        }
        if (formStatus === 'draft' || formStatus === '') {
            return STATUS_INCOMPLETE;
        }
        if (inspStatus === 'pending_hr') {
            return STATUS_PENDING;
        }
        if (inspStatus === 'active') return STATUS_APPROVED;
        return STATUS_INCOMPLETE;
    }

    if (action === 'Rejected' || entry?.details?.acceptanceStatus === 'Rejected') {
        return STATUS_REJECTED;
    }

    const lifecycle = resolveFleetHandoverLifecycle(entry, asset);
    if (lifecycle === 'rejected') return STATUS_REJECTED;
    if (lifecycle === 'approved') return STATUS_APPROVED;
    if (lifecycle === 'accepted') return STATUS_ACCEPTED;
    if (lifecycle === 'pending') return STATUS_PENDING;

    if (action === 'Assigned') {
        return STATUS_PENDING;
    }

    if (action === 'Accepted' || action === 'AcceptWithComments' || action === 'ControllerHandover') {
        return STATUS_APPROVED;
    }

    return STATUS_APPROVED;
}

export function getHandoverHistoryStatus(entry, vehicle = null, options = {}) {
    const status = getHandoverDisplayStatus(entry, vehicle);
    if (status.key !== 'pending') return status;

    const dayInfo = getHandoverEscalationDayInfo(vehicle, entry, options);
    if (!dayInfo) return status;

    return {
        ...status,
        label: `${status.label} · ${formatHandoverEscalationDayLabel(dayInfo)}`,
    };
}

export function getHandoverByLabel(entry, vehicle = null) {
    const action = String(entry?.action || '').trim();

    if (action === 'Returned') {
        const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
        if (frozen) return frozen;
        const returningEmp = fmtHandoverPerson(entry?.assignedTo) || fmtHandoverPerson(entry?.details?.assignedTo);
        return returningEmp || '—';
    }

    if (action === 'Unassigned') {
        return readFrozenHandoverLabel(entry, 'handoverByDisplay', '—');
    }

    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        return readFrozenHandoverLabel(entry, 'handoverByDisplay', '—');
    }

    const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
    if (frozen) return frozen;

    const workflow = entry?.details?.vehicleHandoverWorkflow;
    if (workflow?.wasAssignedFromPool) {
        const adminName = workflow?.stages?.assigner?.actorName;
        if (adminName) return adminName;
    }

    const workflowName = workflow?.stages?.assigner?.actorName;
    if (workflowName) return workflowName;

    const performer = fmtHandoverPerson(entry?.performedBy);
    if (performer) return performer;
    const detailsName = String(entry?.details?.byName || entry?.details?.performedByName || '').trim();
    return detailsName || '—';
}

export function getHandoverToLabel(entry, vehicle = null) {
    const action = String(entry?.action || '').trim();

    if (action === 'Returned') {
        const frozen = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
        if (frozen) return frozen;
        const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
        const fromStage = formatHandoverActorLabel(stage, null);
        return fromStage !== '—' ? fromStage : '—';
    }

    if (action === 'Unassigned') {
        const frozen = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
        if (frozen) return frozen;
        return '—';
    }

    const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
    if (frozenTo) return frozenTo;

    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
        const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
        if (fromStage !== '—') return fromStage;
    }

    if (action === 'Assigned' && !isVehicleInspectionHandoverEntry(entry, vehicle)) {
        const assignee = fmtHandoverPerson(entry?.assignedTo);
        if (assignee) return assignee;
        const details = entry?.details || {};
        return fmtHandoverPerson(details.assignedTo) || '—';
    }

    if (String(entry?.assignedToType || '').toLowerCase() === 'company') {
        const company = fmtHandoverCompany(entry?.assignedCompany);
        if (company) return company;
    }
    const assignee = fmtHandoverPerson(entry?.assignedTo);
    if (assignee) return assignee;
    const details = entry?.details || {};
    if (String(details.assignedToType || '').toLowerCase() === 'company') {
        const company = fmtHandoverCompany(details.assignedCompany);
        if (company) return company;
    }
    const detailsAssignee = fmtHandoverPerson(details.assignedTo);
    return detailsAssignee || '—';
}

/** Workflow target actor — admin officer when assignee cannot self-acknowledge. */
export function getHandoverTargetActorLabel(entry) {
    const workflowName = entry?.details?.vehicleHandoverWorkflow?.stages?.target?.actorName;
    if (workflowName) return workflowName;
    return getHandoverToLabel(entry);
}

export function getHandoverReason(entry, vehicle = null) {
    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        return 'Do inspection';
    }
    if (isVehicleReturnHandoverEntry(entry, vehicle) || String(entry?.action || '').trim() === 'Returned') {
        return 'Vehicle return';
    }

    const linkedId = vehicle?.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    const isLinkedHandover =
        linkedId && entry?._id && String(linkedId) === String(entry._id);

    const candidates = [
        entry?.details?.assignmentReason,
        entry?.comments,
        isLinkedHandover ? vehicle?.pendingActionDetails?.assignmentReason : '',
        entry?.details?.reason,
        entry?.details?.rejectionReason,
        entry?.details?.extensionReason,
        entry?.details?.userStory,
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (candidates[0]) return candidates[0];

    const action = String(entry?.action || '').trim();
    if (action === 'Assigned' && vehicle) {
        const type = String(entry?.details?.assignmentType || vehicle?.assignmentType || '').trim();
        if (type === 'Temporary') {
            const days = entry?.details?.assignedDays ?? vehicle?.assignedDays;
            if (days) return `Temporary assignment (${days} days)`;
            return 'Temporary assignment';
        }
        if (type === 'Permanent') return 'Permanent assignment';
    }

    return '-';
}

export function sortHandoverHistoryEntries(entries = []) {
    return [...entries].sort((a, b) => {
        const timeA = new Date(a?.date || a?.createdAt || 0).getTime();
        const timeB = new Date(b?.date || b?.createdAt || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;

        const statusA = STATUS_SORT_ORDER[getHandoverHistoryStatus(a).key] ?? 9;
        const statusB = STATUS_SORT_ORDER[getHandoverHistoryStatus(b).key] ?? 9;
        if (statusA !== statusB) return statusA - statusB;

        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });
}

export function isLiveHandoverEntry(entry) {
    return Boolean(entry?.isLive);
}

function assigneeKey(entry) {
    if (String(entry?.assignedToType || '').toLowerCase() === 'company') {
        return `company:${entry?.assignedCompany?._id || entry?.assignedCompany || ''}`;
    }
    return `emp:${entry?.assignedTo?._id || entry?.assignedTo || ''}`;
}

export function buildLiveHandoverEntry(asset) {
    if (!asset) return null;

    const isCompany =
        String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany;
    const hasEmployee = Boolean(asset.assignedTo);
    if (!hasEmployee && !isCompany) return null;

    const acceptance = String(asset.acceptanceStatus || '').trim();
    const action = acceptance === 'Accepted' ? 'Accepted' : 'Assigned';

    return {
        _id: `live-${asset._id}`,
        isLive: true,
        action,
        date: asset.assignedDate || asset.updatedAt || asset.createdAt || new Date().toISOString(),
        assignedToType: asset.assignedToType,
        assignedTo: asset.assignedTo,
        assignedCompany: asset.assignedCompany,
        performedBy: asset.assignedBy,
        comments:
            asset.pendingActionDetails?.assignmentReason ||
            asset.assignmentReason ||
            asset.pendingAction?.reason ||
            asset.pendingAction?.comments ||
            '',
        details: {
            ...(asset.details && typeof asset.details === 'object' ? asset.details : {}),
            ...asset,
            assignmentReason: asset.pendingActionDetails?.assignmentReason || asset.assignmentReason || '',
        },
    };
}

function isDuplicateLiveEntry(historyRows, liveRow, asset) {
    if (!liveRow) return true;

    const liveKey = assigneeKey(liveRow);
    const acceptance = String(asset?.acceptanceStatus || '').trim();
    const matching = historyRows.filter((row) => assigneeKey(row) === liveKey);
    if (!matching.length) return false;

    const latest = [...matching].sort(
        (a, b) => new Date(b?.date || b?.createdAt || 0) - new Date(a?.date || a?.createdAt || 0),
    )[0];

    if (acceptance === 'Pending' && latest?.action === 'Assigned') return true;
    if (acceptance === 'Accepted' && latest?.action === 'Accepted') return true;
    return false;
}

export function buildHandoverHistoryRows(assetHistory = [], asset = null) {
    const filtered = (assetHistory || []).filter(isHandoverHistoryEntry);
    const deduped = dedupeHandoverAssignedAcceptedPairs(filtered);
    const liveRow = buildLiveHandoverEntry(asset);

    if (liveRow && !isDuplicateLiveEntry(deduped, liveRow, asset)) {
        deduped.push(liveRow);
    }

    return sortHandoverHistoryEntries(deduped);
}

/** One handover assignment = one row; hide legacy Assigned+Accepted pairs for the same assignee. */
function dedupeHandoverAssignedAcceptedPairs(entries) {
    const acceptedMap = new Map();
    const assignedMap = new Map();

    for (const entry of entries) {
        const key = assigneeKey(entry);
        const action = String(entry?.action || '').trim();
        if (action === 'Accepted') acceptedMap.set(key, entry);
        if (action === 'Assigned') assignedMap.set(key, entry);
    }

    const handledAccepted = new Set();
    const result = [];

    for (const entry of entries) {
        const key = assigneeKey(entry);
        const action = String(entry?.action || '').trim();

        if (action === 'Assigned' && acceptedMap.has(key)) {
            continue;
        }

        if (action === 'Accepted' && assignedMap.has(key)) {
            if (handledAccepted.has(key)) continue;
            handledAccepted.add(key);
            const assigned = assignedMap.get(key);
            result.push({
                ...entry,
                date: assigned?.date || assigned?.createdAt || entry.date,
                createdAt: assigned?.createdAt || entry.createdAt,
            });
            continue;
        }

        result.push(entry);
    }

    return result;
}
