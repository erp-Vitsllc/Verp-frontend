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

export function isVehicleReinspectionHandoverEntry(entry) {
    return entry?.details?.reinspection === true;
}

export function isVehicleInspectionHandoverEntry(entry, vehicle = null) {
    if (String(entry?.details?.handoverKind || '').trim() === 'vehicle_inspection') {
        return true;
    }
    if (entry?.details?.firstInspection === true || entry?.details?.reinspection === true) {
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

/** Completed inspection handover rows that are no longer linked — keep all inspection rows visible. */
function isStaleInactiveHandoverRow(entry, asset) {
    if (!entry || !asset) return false;
    if (isVehicleInspectionHandoverEntry(entry, asset)) return false;
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

function isFleetHandoverHrApproved(entry) {
    const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();
    if (lifecycle === 'approved') return true;
    if (entry?.details?.handoverHrApprovedAt) return true;
    const hrStage = entry?.details?.vehicleHandoverWorkflow?.stages?.hr;
    return Boolean(hrStage?.date);
}

function resolveFleetHandoverLifecycle(entry, vehicle) {
    const action = String(entry?.action || '').trim();
    const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();

    if (lifecycle !== 'rejected' && isFleetHandoverHrApproved(entry)) {
        return 'approved';
    }

    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    const isLinked =
        flow?.historyId && entry?._id && String(flow.historyId) === String(entry._id);
    const vehicleStatus = String(vehicle?.acceptanceStatus || '').trim();

    if (
        vehicleStatus === 'Accepted' &&
        !isLinked &&
        (action === 'Assigned' || action === 'Accepted') &&
        (lifecycle === 'accepted' ||
            lifecycle === 'approved' ||
            Boolean(entry?.details?.vehicleHandoverWorkflow?.stages?.target?.date))
    ) {
        return 'approved';
    }

    if (isLinked && lifecycle !== 'rejected') {
        if (lifecycle === 'approved') return 'approved';
        const stage = String(flow.stage || '').toLowerCase();
        if (stage === 'hr' || stage === 'management' || stage === 'hod') return 'accepted';
        return 'pending';
    }

    if (lifecycle === 'approved' || lifecycle === 'accepted' || lifecycle === 'pending' || lifecycle === 'rejected') {
        return lifecycle;
    }

    if (action === 'Returned' || action === 'Unassigned') {
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

    if (action === 'Accepted') {
        if (lifecycle === 'approved') return 'approved';
        return 'accepted';
    }

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
        const value = String(frozen).trim();
        // Treat placeholder dash as missing so older inspection rows can fall back.
        if (value === '—' || value === '-') return fallback;
        return value;
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

    if (action === 'ControllerHandover') {
        return lifecycle === 'approved' ? STATUS_APPROVED : STATUS_ACCEPTED;
    }

    return STATUS_PENDING;
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
    const workflow = entry?.details?.vehicleHandoverWorkflow;

    if (
        (action === 'Assigned' || action === 'Accepted') &&
        !isVehicleInspectionHandoverEntry(entry, vehicle)
    ) {
        const frozenAssigner = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
        if (frozenAssigner) return frozenAssigner;
    }

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
        // Reinspection: By = To = assigned owner, else Admin Officer.
        if (isVehicleReinspectionHandoverEntry(entry)) {
            const frozenBy = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
            if (frozenBy) return frozenBy;
            const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
            if (frozenTo) return frozenTo;
            const liveAssignee = fmtHandoverPerson(vehicle?.assignedTo);
            if (liveAssignee) return liveAssignee;
            const assignee = fmtHandoverPerson(entry?.assignedTo);
            if (assignee) return assignee;
            const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
            const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
            if (fromStage !== '—') return fromStage;
            return '—';
        }
        // First inspection: Handover By stays empty.
        return '—';
    }

    if (workflow?.wasAssignedFromPool) {
        const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
        if (frozen) return frozen;
        const adminName = workflow?.stages?.assigner?.actorName;
        if (adminName) return adminName;
    }

    const fromDetails = fmtHandoverPerson(entry?.details?.assignedBy);
    if (fromDetails) return fromDetails;

    const performer = fmtHandoverPerson(entry?.performedBy);
    if (performer) return performer;

    const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
    if (frozen) return frozen;

    const workflowName = workflow?.stages?.assigner?.actorName;
    if (workflowName) return workflowName;

    const detailsName = String(entry?.details?.byName || entry?.details?.performedByName || '').trim();
    return detailsName || '—';
}

export function getHandoverToLabel(entry, vehicle = null) {
    const action = String(entry?.action || '').trim();

    if (
        (action === 'Assigned' || action === 'Accepted') &&
        !isVehicleInspectionHandoverEntry(entry, vehicle)
    ) {
        const frozenAssignee = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
        if (frozenAssignee) return frozenAssignee;
    }

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

    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        // Inspection / reinspection: To = assigned owner, else Admin Officer.
        // Reinspection By uses the same person (see getHandoverByLabel).
        const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
        if (frozenTo) return frozenTo;
        if (isVehicleReinspectionHandoverEntry(entry)) {
            const liveAssignee = fmtHandoverPerson(vehicle?.assignedTo);
            if (liveAssignee) return liveAssignee;
        }
        const assignee = fmtHandoverPerson(entry?.assignedTo);
        if (assignee) return assignee;
        const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
        const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
        if (fromStage !== '—') return fromStage;
        return '—';
    }

    if (action === 'Assigned' || action === 'Accepted') {
        const assignee = fmtHandoverPerson(entry?.assignedTo);
        if (assignee) return assignee;
        const details = entry?.details || {};
        const fromDetails = fmtHandoverPerson(details.assignedTo);
        if (fromDetails) return fromDetails;
    }

    const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
    if (frozenTo) return frozenTo;

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
        if (entry?.details?.reinspection === true) return 'Reinspection';
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

/** Table Type: Assign | Reassign | Return | Inspection | Reinspection */
export function getHandoverTypeLabel(entry, vehicle = null) {
    if (isVehicleReinspectionHandoverEntry(entry)) return 'Reinspection';
    if (isVehicleInspectionHandoverEntry(entry, vehicle)) return 'Inspection';

    const action = String(entry?.action || '').trim();
    if (
        isVehicleReturnHandoverEntry(entry, vehicle) ||
        action === 'Returned' ||
        action === 'Unassigned'
    ) {
        return 'Return';
    }

    const workflow = entry?.details?.vehicleHandoverWorkflow;
    if (workflow?.wasAssignedFromPool === true) return 'Assign';
    if (workflow?.previousAssigneeId) return 'Reassign';
    if (workflow?.wasAssignedFromPool === false) return 'Reassign';

    return 'Assign';
}

/** Assignment / handover start date (row created). */
export function getHandoverStartDate(entry) {
    return entry?.date || entry?.createdAt || null;
}

/**
 * End date = HR / final approval date when the handover is approved.
 * Pending / incomplete / rejected / mid-flow accepted rows have no end date.
 */
export function getHandoverEndDate(entry, vehicle = null) {
    const status = getHandoverDisplayStatus(entry, vehicle);
    if (status.key !== 'approved') return null;

    const details = entry?.details || {};
    const candidates = [
        details.handoverHrApprovedAt,
        details.vehicleHandoverWorkflow?.stages?.hr?.date,
        details.vehicleHandoverWorkflow?.stages?.management?.date,
        details.inspectionApprovedAt,
        details.approvedAt,
        entry?.date,
        entry?.updatedAt,
        entry?.createdAt,
    ];

    for (const value of candidates) {
        if (!value) continue;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return value;
    }
    return null;
}

/** Latest handover first, oldest last (by start date / createdAt). */
export function sortHandoverHistoryEntries(entries = []) {
    return [...entries].sort((a, b) => {
        const timeA = new Date(a?.createdAt || a?.date || 0).getTime();
        const timeB = new Date(b?.createdAt || b?.date || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;

        const startA = new Date(getHandoverStartDate(a) || 0).getTime();
        const startB = new Date(getHandoverStartDate(b) || 0).getTime();
        if (startA !== startB) return startB - startA;

        return String(b?._id || '').localeCompare(String(a?._id || ''));
    });
}

function assigneeKey(entry) {
    if (String(entry?.assignedToType || '').toLowerCase() === 'company') {
        return `company:${entry?.assignedCompany?._id || entry?.assignedCompany || ''}`;
    }
    return `emp:${entry?.assignedTo?._id || entry?.assignedTo || ''}`;
}

export function isSameHandoverAssignee(left, right) {
    if (!left || !right) return false;
    return assigneeKey(left) === assigneeKey(right);
}

export function isMongoHistoryId(value) {
    return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

/** Map table row (incl. synthetic live rows) to the AssetHistory _id used for DELETE. */
export function resolveHandoverDeleteHistoryId(entry, asset = null, assetHistory = []) {
    const rawId = entry?._id;
    if (!rawId) return null;
    const idStr = String(rawId).trim();
    if (isMongoHistoryId(idStr)) return idStr;

    if (!idStr.startsWith('live-')) return null;

    const flowId = asset?.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    if (flowId && isMongoHistoryId(flowId)) return String(flowId);

    const inspId = asset?.vehicleInspectionHandoverHistoryId;
    if (inspId && isMongoHistoryId(inspId)) return String(inspId);

    const liveKey = assigneeKey(entry);
    const linkedHistory = (assetHistory || [])
        .filter((row) => {
            const action = String(row?.action || '').trim();
            return action === 'Assigned' || action === 'Accepted';
        })
        .filter((row) => assigneeKey(row) === liveKey)
        .sort(
            (a, b) =>
                new Date(b?.date || b?.createdAt || 0).getTime() -
                new Date(a?.date || a?.createdAt || 0).getTime(),
        )[0];

    if (linkedHistory?._id && isMongoHistoryId(linkedHistory._id)) {
        return String(linkedHistory._id);
    }

    return null;
}

export function isLiveHandoverEntry(entry) {
    return Boolean(entry?.isLive);
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
            assignmentReason:
                asset.pendingActionDetails?.assignmentReason || asset.assignmentReason || '',
            acceptanceStatus: asset.acceptanceStatus || '',
            assignmentType: asset.assignmentType || '',
            assignedDays: asset.assignedDays ?? null,
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

function shouldIncludeLiveHandoverRow(asset, historyRows) {
    if (!asset) return false;

    const isCompany =
        String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany;
    const hasEmployee = Boolean(asset.assignedTo);
    if (!hasEmployee && !isCompany) return false;

    const acceptance = String(asset.acceptanceStatus || '').trim();
    const flowHistoryId = asset.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    const inspId = asset.vehicleInspectionHandoverHistoryId;
    const inspStatus = String(asset.vehicleInspectionStatus || '').toLowerCase();

    if (acceptance === 'Pending') {
        const liveRow = buildLiveHandoverEntry(asset);
        return Boolean(liveRow && !isDuplicateLiveEntry(historyRows, liveRow, asset));
    }

    if (flowHistoryId) {
        const flowId = String(flowHistoryId);
        const flowRowLoaded = historyRows.some((row) => String(row?._id) === flowId);
        if (!flowRowLoaded) return true;
    }

    if (inspId && (inspStatus === 'draft' || inspStatus === 'pending_hr')) {
        const inspRowLoaded = historyRows.some((row) => String(row?._id) === String(inspId));
        if (!inspRowLoaded) return true;
    }

    return false;
}

export function buildHandoverHistoryRows(assetHistory = [], asset = null) {
    const filtered = (assetHistory || [])
        .filter(isHandoverHistoryEntry)
        .filter((entry) => !isStaleInactiveHandoverRow(entry, asset));
    const deduped = dedupeSameHandoverAssignments(dedupeHandoverAssignedAcceptedPairs(filtered));

    if (shouldIncludeLiveHandoverRow(asset, deduped)) {
        const liveRow = buildLiveHandoverEntry(asset);
        if (liveRow) deduped.push(liveRow);
    }

    return sortHandoverHistoryEntries(deduped);
}

/** One handover assignment = one row; hide legacy Assigned+Accepted pairs for the same assignee. */
function dedupeHandoverAssignedAcceptedPairs(entries) {
    const acceptedMap = new Map();
    const assignedMap = new Map();

    for (const entry of entries) {
        if (isVehicleInspectionHandoverEntry(entry)) continue;
        const key = assigneeKey(entry);
        const action = String(entry?.action || '').trim();
        if (action === 'Accepted') acceptedMap.set(key, entry);
        if (action === 'Assigned') assignedMap.set(key, entry);
    }

    const handledAccepted = new Set();
    const result = [];

    for (const entry of entries) {
        if (isVehicleInspectionHandoverEntry(entry)) {
            result.push(entry);
            continue;
        }

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

        if (action === 'Accepted' && !assignedMap.has(key)) {
            if (handledAccepted.has(key)) continue;
            handledAccepted.add(key);
        }

        result.push(entry);
    }

    return result;
}

function handoverAssignmentKey(entry) {
    const reason = String(entry?.details?.assignmentReason || entry?.comments || '')
        .trim()
        .toLowerCase();
    const day = new Date(entry?.date || entry?.createdAt || 0);
    const dayKey = Number.isNaN(day.getTime())
        ? ''
        : `${day.getUTCFullYear()}-${day.getUTCMonth()}-${day.getUTCDate()}`;
    return `${assigneeKey(entry)}|${reason}|${dayKey}`;
}

function handoverLifecycleRank(entry) {
    const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();
    if (lifecycle === 'approved') return 4;
    if (lifecycle === 'accepted') return 3;
    const action = String(entry?.action || '').trim();
    if (action === 'Accepted') return 3;
    if (action === 'Assigned' && lifecycle === 'accepted') return 3;
    if (action === 'Assigned') return 2;
    return 1;
}

function pickBestHandoverLifecycle(entries) {
    const order = ['approved', 'accepted', 'pending', 'rejected'];
    let best = '';
    let bestRank = -1;
    for (const entry of entries) {
        const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();
        const normalized =
            lifecycle ||
            (String(entry?.action || '').trim() === 'Accepted' ? 'accepted' : 'pending');
        const rank = order.indexOf(normalized);
        if (rank >= 0 && rank > bestRank) {
            bestRank = rank;
            best = normalized;
        }
    }
    return best;
}

/** Collapse duplicate rows for the same assignment (e.g. extra Accepted row after HR). */
function dedupeSameHandoverAssignments(entries) {
    const groups = new Map();

    for (const entry of entries) {
        if (isVehicleInspectionHandoverEntry(entry)) {
            groups.set(`insp:${entry?._id || Math.random()}`, [entry]);
            continue;
        }
        const key = handoverAssignmentKey(entry);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }

    const result = [];
    for (const group of groups.values()) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        const sorted = [...group].sort((a, b) => {
            const rankDiff = handoverLifecycleRank(b) - handoverLifecycleRank(a);
            if (rankDiff) return rankDiff;
            const wfA = Boolean(a?.details?.vehicleHandoverWorkflow);
            const wfB = Boolean(b?.details?.vehicleHandoverWorkflow);
            if (wfA !== wfB) return Number(wfB) - Number(wfA);
            const assignedA = String(a?.action || '').trim() === 'Assigned' ? 1 : 0;
            const assignedB = String(b?.action || '').trim() === 'Assigned' ? 1 : 0;
            if (assignedA !== assignedB) return assignedB - assignedA;
            return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
        });

        const canonical = sorted[0];
        const bestLifecycle = pickBestHandoverLifecycle(group);
        if (bestLifecycle && bestLifecycle !== canonical?.details?.handoverLifecycleStatus) {
            result.push({
                ...canonical,
                details: {
                    ...(canonical.details || {}),
                    handoverLifecycleStatus: bestLifecycle,
                },
            });
        } else {
            result.push(canonical);
        }
    }

    return result;
}
