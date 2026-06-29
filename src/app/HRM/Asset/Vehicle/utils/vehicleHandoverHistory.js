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

const STATUS_SORT_ORDER = { pending: 0, accepted: 1, approved: 2, rejected: 3 };

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

function isActiveFleetHandoverFlow(vehicle, entry) {
    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    if (!flow?.stage || !entry?._id) return false;
    const historyId = flow.historyId || flow.historyRecordId;
    if (!historyId) return false;
    return String(historyId) === String(entry._id);
}

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

export function isHandoverHistoryEntry(entry) {
    const action = String(entry?.action || '').trim();
    if (!HANDOVER_HISTORY_ACTIONS.has(action)) return false;
    if (HANDOVER_ACTIONS_REQUIRING_ASSIGNEE.has(action) && !hasHandoverAssignee(entry)) {
        return false;
    }
    return true;
}

export function getHandoverDisplayStatus(entry, vehicle = null) {
    const action = String(entry?.action || '').trim();
    const asset = vehicle || (entry?.isLive && entry?.details ? entry.details : null);

    if (action === 'Rejected') {
        return STATUS_REJECTED;
    }

    if (isActiveFleetHandoverFlow(asset, entry)) {
        const stage = asset.pendingActionDetails.vehicleHandoverFlow.stage;
        if (stage === 'target') return STATUS_PENDING;
        return STATUS_ACCEPTED;
    }

    if (action === 'Assigned') {
        const acceptance = String(
            asset?.acceptanceStatus || entry?.details?.acceptanceStatus || '',
        ).trim();
        if (acceptance === 'Accepted') return STATUS_ACCEPTED;
        return STATUS_PENDING;
    }

    if (action === 'Accepted' || action === 'AcceptWithComments' || action === 'ControllerHandover') {
        return STATUS_APPROVED;
    }

    return STATUS_APPROVED;
}

export function getHandoverHistoryStatus(entry, vehicle = null) {
    return getHandoverDisplayStatus(entry, vehicle);
}

export function getHandoverByLabel(entry) {
    const workflowName = entry?.details?.vehicleHandoverWorkflow?.stages?.assigner?.actorName;
    if (workflowName) return workflowName;

    const performer = fmtHandoverPerson(entry?.performedBy);
    if (performer) return performer;
    const detailsName = String(entry?.details?.byName || entry?.details?.performedByName || '').trim();
    return detailsName || '-';
}

export function getHandoverToLabel(entry) {
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
    return detailsAssignee || '-';
}

/** Workflow target actor — admin officer when assignee cannot self-acknowledge. */
export function getHandoverTargetActorLabel(entry) {
    const workflowName = entry?.details?.vehicleHandoverWorkflow?.stages?.target?.actorName;
    if (workflowName) return workflowName;
    return getHandoverToLabel(entry);
}

export function getHandoverReason(entry) {
    const candidates = [
        entry?.comments,
        entry?.details?.assignmentReason,
        entry?.details?.reason,
        entry?.details?.rejectionReason,
        entry?.details?.extensionReason,
        entry?.details?.userStory,
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    return candidates[0] || '-';
}

export function sortHandoverHistoryEntries(entries = []) {
    return [...entries].sort((a, b) => {
        const statusA = STATUS_SORT_ORDER[getHandoverHistoryStatus(a).key] ?? 9;
        const statusB = STATUS_SORT_ORDER[getHandoverHistoryStatus(b).key] ?? 9;
        if (statusA !== statusB) return statusA - statusB;

        const timeA = new Date(a?.date || a?.createdAt || 0).getTime();
        const timeB = new Date(b?.date || b?.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;

        return String(a?._id || '').localeCompare(String(b?._id || ''));
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
            asset.assignmentReason ||
            asset.pendingAction?.reason ||
            asset.pendingAction?.comments ||
            '',
        details: asset,
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
