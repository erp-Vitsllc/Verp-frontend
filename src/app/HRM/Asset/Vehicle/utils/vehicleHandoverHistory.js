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

export function handoverPersonId(person) {
    if (!person) return '';
    if (typeof person === 'object') return String(person._id || person.id || '').trim();
    return String(person).trim();
}

export function fmtHandoverPerson(person) {
    if (!person) return '';
    if (typeof person !== 'object') return '';
    const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    const empId = String(person.employeeId || '').trim();
    if (name && empId) return `${name} (${empId})`;
    return name || empId || '';
}

export function fmtHandoverCompany(company) {
    if (!company) return '';
    if (typeof company === 'object') return company.name || company.companyId || '';
    return String(company);
}

function formatHandoverActorLabel(stage, person) {
    const rawName = String(stage?.actorName || '').trim();
    const personLabel = fmtHandoverPerson(person);
    const name = rawName || personLabel;
    const empId = String(stage?.actorEmployeeId || person?.employeeId || '').trim();
    if (name && empId && !name.includes(empId)) return `${name} (${empId})`;
    return name || empId || '—';
}

function entryTimestamp(entry) {
    const value = entry?.date || entry?.createdAt;
    const parsed = value ? new Date(Date.parse(value)) : 0;
    return Number.isNaN(parsed) ? 0 : parsed.getTime();
}

/** Assignee stored on this history row — never a later live vehicle snapshot. */
function resolveEntryAssigneePerson(entry) {
    const historyAssignee = entry?.assignedTo;
    if (historyAssignee && typeof historyAssignee === 'object' && (historyAssignee.firstName || historyAssignee.employeeId)) {
        return historyAssignee;
    }
    const detailsAssignee = entry?.details?.assignedTo;
    if (detailsAssignee && typeof detailsAssignee === 'object') {
        const historyId = handoverPersonId(entry?.assignedTo);
        const detailsId = handoverPersonId(detailsAssignee);
        if (!historyId || historyId === detailsId) return detailsAssignee;
    }
    return historyAssignee && typeof historyAssignee === 'object' ? historyAssignee : null;
}

function isRejectedHandoverAction(entry) {
    const action = String(entry?.action || '').trim();
    if (action === 'Rejected') return true;
    return String(entry?.details?.acceptanceStatus || '').trim() === 'Rejected';
}

function isSameHandoverCycleRow(left, right) {
    if (!left || !right) return false;
    if (String(left._id || '') && String(left._id) === String(right._id)) return true;
    if ((left.isLive || right.isLive) && assigneeKey(left) === assigneeKey(right)) return true;
    return false;
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
    // Explicit pending/accepted must not inherit inspection or previous-cycle HR dates.
    if (lifecycle === 'pending' || lifecycle === 'accepted') return false;
    if (entry?.details?.handoverHrApprovedAt) return true;
    const hrStage = entry?.details?.vehicleHandoverWorkflow?.stages?.hr;
    return Boolean(hrStage?.date);
}

function resolveFleetHandoverLifecycle(entry, vehicle, options = {}) {
    const action = String(entry?.action || '').trim();
    const lifecycle = String(entry?.details?.handoverLifecycleStatus || '').trim().toLowerCase();

    const flow = vehicle?.pendingActionDetails?.vehicleHandoverFlow;
    const isLinked =
        flow?.historyId && entry?._id && String(flow.historyId) === String(entry._id);
    const vehicleStatus = String(vehicle?.acceptanceStatus || '').trim();

    if (entry?.details?.hrApprovalSkipped === true || options.noEditApproved === true) {
        return 'approved';
    }

    // Approved wins over a leftover HR flow so no-edit handovers do not stay "Accepted".
    if (lifecycle === 'approved') return 'approved';

    // Current in-flight handover: trust the live flow, not leftover HR dates.
    if (isLinked && lifecycle !== 'rejected') {
        const stage = String(flow.stage || '').toLowerCase();
        if (stage === 'hr' || stage === 'management' || stage === 'hod') return 'accepted';
        if (stage === 'target' || !stage) return 'pending';
        return 'pending';
    }

    if (lifecycle !== 'rejected' && isFleetHandoverHrApproved(entry)) {
        return 'approved';
    }

    // Returns/unassigns: resolve before generic lifecycle so a newer pending cycle
    // cannot rewrite an already-completed return row to Pending.
    if (action === 'Returned' || action === 'Unassigned') {
        const isLinkedReturn =
            action === 'Returned' &&
            flow?.isReturn &&
            flow?.historyId &&
            entry?._id &&
            String(flow.historyId) === String(entry._id);
        if (isLinkedReturn) {
            if (lifecycle === 'approved') return 'approved';
            const stage = String(flow.stage || '').toLowerCase();
            if (stage === 'hr' || stage === 'management' || stage === 'hod') return 'accepted';
            return 'pending';
        }
        if (lifecycle === 'rejected') return 'rejected';
        if (
            lifecycle === 'approved' ||
            lifecycle === 'accepted' ||
            String(entry?.details?.status || '').trim() === 'ApprovedAndFinalized'
        ) {
            return lifecycle === 'accepted' ? 'accepted' : 'approved';
        }
        // Unlinked return rows are finished history — never show live pending.
        return 'approved';
    }

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

export function getHandoverDisplayStatus(entry, vehicle = null, options = {}) {
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

    const lifecycle = resolveFleetHandoverLifecycle(entry, asset, options);
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
    const status = getHandoverDisplayStatus(entry, vehicle, options);
    if (status.key !== 'pending') return status;

    const dayInfo = getHandoverEscalationDayInfo(vehicle, entry, options);
    if (!dayInfo) return status;

    return {
        ...status,
        label: `${status.label} · ${formatHandoverEscalationDayLabel(dayInfo)}`,
    };
}

function resolveHandoverLabelOptions(entry, vehicle, options = {}) {
    const allRows = Array.isArray(options.allRows) ? options.allRows : [];
    const previousEntry =
        options.previousEntry ||
        (allRows.length ? findPreviousFleetHandoverEntry(entry, allRows, vehicle) : null);
    return { ...options, previousEntry, allRows };
}

/** Last fleet holder before this row. Skip inspection, rejected, and same-cycle rows. */
export function findPreviousFleetHandoverEntry(entry, rows = [], vehicle = null) {
    if (!entry || !Array.isArray(rows) || !rows.length) return null;

    const before = sortHandoverHistoryEntries(rows).filter((row) => {
        if (!row || isSameHandoverCycleRow(row, entry)) return false;
        if (isVehicleInspectionHandoverEntry(row, vehicle)) return false;
        if (isRejectedHandoverAction(row)) return false;
        const rowTs = entryTimestamp(row);
        const entryTs = entryTimestamp(entry);
        if (rowTs < entryTs) return true;
        if (rowTs > entryTs) return false;
        return String(row?._id || '') < String(entry?._id || '');
    });

    for (let i = before.length - 1; i >= 0; i -= 1) {
        const row = before[i];
        const action = String(row?.action || '').trim();
        if (action === 'Returned' || action === 'Unassigned') return null;
        if (
            action === 'Assigned' ||
            action === 'Accepted' ||
            action === 'Transfer' ||
            action === 'ControllerHandover'
        ) {
            return row;
        }
    }
    return null;
}

function previousHolderLabel(previousEntry, vehicle = null) {
    if (!previousEntry) return '';
    const frozenTo = readFrozenHandoverLabel(previousEntry, 'handoverToDisplay', null);
    if (frozenTo) return frozenTo;
    const assignee = fmtHandoverPerson(resolveEntryAssigneePerson(previousEntry));
    if (assignee) return assignee;
    const stage = previousEntry?.details?.vehicleHandoverWorkflow?.stages?.target;
    const fromStage = formatHandoverActorLabel(stage, previousEntry?.assignedTo);
    return fromStage !== '—' ? fromStage : '';
}

function adminOfficerLabel(entry) {
    const workflow = entry?.details?.vehicleHandoverWorkflow;
    const stage = workflow?.stages?.assigner;
    const fromStage = formatHandoverActorLabel(stage, entry?.performedBy);
    if (fromStage && fromStage !== '—') return fromStage;
    const performer = fmtHandoverPerson(entry?.performedBy);
    if (performer) return performer;
    const workflowName = String(stage?.actorName || '').trim();
    if (workflowName) return workflowName;
    return String(entry?.details?.byName || entry?.details?.performedByName || '').trim();
}

export function getHandoverByLabel(entry, vehicle = null, options = {}) {
    const action = String(entry?.action || '').trim();
    const { previousEntry } = resolveHandoverLabelOptions(entry, vehicle, options);
    const workflow = entry?.details?.vehicleHandoverWorkflow;
    const fromPool = workflow?.wasAssignedFromPool === true && !previousEntry;

    if (action === 'Returned') {
        const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
        if (frozen) return frozen;
        const returningEmp = fmtHandoverPerson(resolveEntryAssigneePerson(entry));
        return returningEmp || '—';
    }

    if (action === 'Unassigned') {
        return readFrozenHandoverLabel(entry, 'handoverByDisplay', '—');
    }

    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        if (isVehicleReinspectionHandoverEntry(entry)) {
            const frozenBy = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
            if (frozenBy) return frozenBy;
            const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
            if (frozenTo) return frozenTo;
            const assignee = fmtHandoverPerson(resolveEntryAssigneePerson(entry));
            if (assignee) return assignee;
            const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
            const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
            if (fromStage !== '—') return fromStage;
            return '—';
        }
        return '—';
    }

    if (action === 'Assigned' || action === 'Accepted' || action === 'Transfer' || action === 'ControllerHandover') {
        const holder = previousHolderLabel(previousEntry, vehicle);
        if (holder) return holder;

        const workflowPrev = String(workflow?.previousAssigneeName || '').trim();
        const workflowPrevId = String(workflow?.previousAssigneeEmployeeId || '').trim();
        if (workflowPrev) {
            return workflowPrevId && !workflowPrev.includes(workflowPrevId)
                ? `${workflowPrev} (${workflowPrevId})`
                : workflowPrev;
        }
        if (workflow?.previousAssigneeId && !fromPool) {
            const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
            if (frozen) return frozen;
        }

        if (fromPool || workflow?.wasAssignedFromPool === true) {
            const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
            if (frozen) return frozen;
            return adminOfficerLabel(entry) || '—';
        }

        const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
        if (frozen) return frozen;
        return adminOfficerLabel(entry) || '—';
    }

    const frozen = readFrozenHandoverLabel(entry, 'handoverByDisplay', null);
    if (frozen) return frozen;
    return adminOfficerLabel(entry) || '—';
}

export function getHandoverToLabel(entry, vehicle = null, options = {}) {
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

    if (isVehicleInspectionHandoverEntry(entry, vehicle)) {
        const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
        if (frozenTo) return frozenTo;
        const assignee = fmtHandoverPerson(resolveEntryAssigneePerson(entry));
        if (assignee) return assignee;
        const stage = entry?.details?.vehicleHandoverWorkflow?.stages?.target;
        const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
        if (fromStage !== '—') return fromStage;
        return '—';
    }

    const frozenTo = readFrozenHandoverLabel(entry, 'handoverToDisplay', null);
    if (frozenTo) return frozenTo;

    if (String(entry?.assignedToType || '').toLowerCase() === 'company') {
        const company = fmtHandoverCompany(entry?.assignedCompany);
        if (company) return company;
    }

    const assignee = fmtHandoverPerson(resolveEntryAssigneePerson(entry));
    if (assignee) return assignee;

    const details = entry?.details || {};
    if (String(details.assignedToType || '').toLowerCase() === 'company') {
        const company = fmtHandoverCompany(details.assignedCompany);
        if (company) return company;
    }

    const stage = details.vehicleHandoverWorkflow?.stages?.target;
    const fromStage = formatHandoverActorLabel(stage, entry?.assignedTo);
    if (fromStage !== '—') return fromStage;
    return '—';
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
export function getHandoverTypeLabel(entry, vehicle = null, options = {}) {
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

    const { previousEntry } = resolveHandoverLabelOptions(entry, vehicle, options);
    const workflow = entry?.details?.vehicleHandoverWorkflow;
    if (previousEntry) return 'Reassign';
    if (workflow?.previousAssigneeId || workflow?.previousAssigneeName) return 'Reassign';
    if (workflow?.wasAssignedFromPool === false) return 'Reassign';
    if (workflow?.wasAssignedFromPool === true) return 'Assign';

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
export function getHandoverEndDate(entry, vehicle = null, options = {}) {
    const status = getHandoverDisplayStatus(entry, vehicle, options);
    if (status.key !== 'approved') return null;

    const start = getHandoverStartDate(entry);
    const startMs = start ? new Date(start).getTime() : NaN;
    const details = entry?.details || {};
    const isInspection = isVehicleInspectionHandoverEntry(entry, vehicle);
    const candidates = [
        details.handoverHrApprovedAt,
        details.vehicleHandoverWorkflow?.stages?.hr?.date,
        details.vehicleHandoverWorkflow?.stages?.management?.date,
        isInspection ? details.inspectionApprovedAt : null,
        details.approvedAt,
        entry?.updatedAt,
        entry?.date,
        entry?.createdAt,
    ];

    for (const value of candidates) {
        if (!value) continue;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) continue;
        if (!Number.isNaN(startMs) && date.getTime() < startMs) continue;
        return value;
    }
    return Number.isNaN(startMs) ? null : start;
}

/** Oldest handover first, latest last (by start date / createdAt). */
export function sortHandoverHistoryEntries(entries = []) {
    return [...entries].sort((a, b) => {
        const startA = new Date(getHandoverStartDate(a) || a?.createdAt || 0).getTime();
        const startB = new Date(getHandoverStartDate(b) || b?.createdAt || 0).getTime();
        if (startA !== startB) return startA - startB;

        const timeA = new Date(a?.createdAt || a?.date || 0).getTime();
        const timeB = new Date(b?.createdAt || b?.date || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;

        return String(a?._id || '').localeCompare(String(b?._id || ''));
    });
}

/**
 * Admin may only delete the oldest remaining row (top of list).
 * Newer rows can be deleted only after all past (older) rows are removed.
 */
export function getHandoverListDeleteBlockReason(rows = [], rowIndex) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        return 'No handover rows to delete.';
    }
    if (rowIndex < 0 || rowIndex >= list.length) {
        return 'This handover row is not in the list.';
    }
    if (rowIndex === 0) return null;
    return 'Cannot delete this handover yet. Delete the past (older) rows first, starting from the top of the list.';
}

export function canDeleteHandoverHistoryListRow(rows = [], rowIndex) {
    return !getHandoverListDeleteBlockReason(rows, rowIndex);
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

export function buildLiveHandoverEntry(asset, historyRows = []) {
    if (!asset) return null;

    const isCompany =
        String(asset.assignedToType || '').toLowerCase() === 'company' && asset.assignedCompany;
    const hasEmployee = Boolean(asset.assignedTo);
    if (!hasEmployee && !isCompany) return null;

    const acceptance = String(asset.acceptanceStatus || '').trim();
    const action = acceptance === 'Accepted' ? 'Accepted' : 'Assigned';
    const flow = asset.pendingActionDetails?.vehicleHandoverFlow;
    const previousEntry = findPreviousFleetHandoverEntry(
        {
            _id: flow?.historyId || `live-${asset._id}`,
            isLive: true,
            action: 'Assigned',
            date: asset.assignedDate || asset.updatedAt || asset.createdAt,
            assignedTo: asset.assignedTo,
            assignedCompany: asset.assignedCompany,
            assignedToType: asset.assignedToType,
        },
        historyRows,
        asset,
    );
    const fromPool = !previousEntry;
    const toLabel = fmtHandoverPerson(asset.assignedTo) || fmtHandoverCompany(asset.assignedCompany);
    const byLabel = fromPool
        ? fmtHandoverPerson(asset.assignedBy) || '—'
        : previousHolderLabel(previousEntry, asset);

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
            handoverLifecycleStatus: acceptance === 'Accepted' ? 'accepted' : 'pending',
            handoverByDisplay: byLabel || undefined,
            handoverToDisplay: toLabel || undefined,
            vehicleHandoverWorkflow: {
                wasAssignedFromPool: fromPool,
                previousAssigneeId: handoverPersonId(previousEntry?.assignedTo) || undefined,
                previousAssigneeName: previousHolderLabel(previousEntry, asset) || undefined,
            },
        },
    };
}

function isDuplicateLiveEntry(historyRows, liveRow, asset) {
    if (!liveRow) return true;

    const flowId = asset?.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    if (flowId && historyRows.some((row) => String(row?._id) === String(flowId))) return true;

    const inspId = asset?.vehicleInspectionHandoverHistoryId;
    const inspStatus = String(asset?.vehicleInspectionStatus || '').toLowerCase();
    if (
        inspId &&
        (inspStatus === 'draft' || inspStatus === 'pending_hr') &&
        historyRows.some((row) => String(row?._id) === String(inspId))
    ) {
        return true;
    }

    const liveKey = assigneeKey(liveRow);
    const acceptance = String(asset?.acceptanceStatus || '').trim();
    const matching = historyRows.filter(
        (row) => !isVehicleInspectionHandoverEntry(row, asset) && assigneeKey(row) === liveKey,
    );
    if (!matching.length) return false;

    const latest = [...matching].sort((a, b) => entryTimestamp(b) - entryTimestamp(a))[0];
    const latestAction = String(latest?.action || '').trim();

    if (acceptance === 'Pending' && latestAction === 'Assigned') return true;
    if (acceptance === 'Accepted' && latestAction === 'Accepted') return true;
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

    if (flowHistoryId && historyRows.some((row) => String(row?._id) === String(flowHistoryId))) {
        return false;
    }

    if (acceptance === 'Pending') {
        const liveRow = buildLiveHandoverEntry(asset, historyRows);
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
    const deduped = dedupeHandoverAssignedAcceptedPairs(filtered);

    if (shouldIncludeLiveHandoverRow(asset, deduped)) {
        const liveRow = buildLiveHandoverEntry(asset, deduped);
        if (liveRow && !deduped.some((row) => String(row?._id) === String(liveRow._id))) {
            deduped.push(liveRow);
        }
    }

    return sortHandoverHistoryEntries(deduped);
}

function hasInterveningFleetHandover(entries, startEntry, endEntry) {
    const startTs = entryTimestamp(startEntry);
    const endTs = entryTimestamp(endEntry);
    const startId = String(startEntry?._id || '');
    const endId = String(endEntry?._id || '');
    return entries.some((row) => {
        if (isVehicleInspectionHandoverEntry(row)) return false;
        const id = String(row?._id || '');
        if (id === startId || id === endId) return false;
        const action = String(row?.action || '').trim();
        if (!['Assigned', 'Accepted', 'Returned', 'Unassigned', 'Rejected'].includes(action)) {
            return false;
        }
        const ts = entryTimestamp(row);
        return ts > startTs && ts < endTs;
    });
}

/** Legacy Assigned + Accepted pair for the same cycle only — never hide a later re-assignment. */
function dedupeHandoverAssignedAcceptedPairs(entries) {
    const skipAssignedIds = new Set();
    const assignedDateByAcceptedId = new Map();

    for (const assigned of entries) {
        if (isVehicleInspectionHandoverEntry(assigned)) continue;
        if (String(assigned?.action || '').trim() !== 'Assigned') continue;
        const key = assigneeKey(assigned);
        const assignedTs = entryTimestamp(assigned);

        const accepted = entries.find((row) => {
            if (isVehicleInspectionHandoverEntry(row)) return false;
            if (String(row?.action || '').trim() !== 'Accepted') return false;
            if (assigneeKey(row) !== key) return false;
            if (String(row?._id) === String(assigned?._id)) return false;
            const acceptedTs = entryTimestamp(row);
            if (acceptedTs < assignedTs) return false;
            return !hasInterveningFleetHandover(entries, assigned, row);
        });

        if (!accepted) continue;
        skipAssignedIds.add(String(assigned._id));
        assignedDateByAcceptedId.set(
            String(accepted._id),
            assigned?.date || assigned?.createdAt || accepted.date,
        );
    }

    return entries
        .filter((entry) => !skipAssignedIds.has(String(entry?._id || '')))
        .map((entry) => {
            const start = assignedDateByAcceptedId.get(String(entry?._id || ''));
            if (!start) return entry;
            return { ...entry, date: start };
        });
}
