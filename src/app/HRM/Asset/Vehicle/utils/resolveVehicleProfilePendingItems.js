import {
    buildVehicleServiceListRows,
    normalizeMongoId,
    resolveVehicleServiceListRowTone,
} from '../components/vehicleServiceUtils';
import { getVehicleListWaitingLabel } from '../components/vehicleAssetStatusUi';
import { getHandoverDisplayStatus, isVehicleInspectionHandoverEntry } from './vehicleHandoverHistory';
import {
    formatHandoverEscalationDayLabel,
    getHandoverEscalationDayInfo,
} from './vehicleHandoverEscalationUi';
import {
    getEffectiveHandoverStage,
    getHandoverAssigneeCanSelfAcknowledge,
} from './vehicleHandoverAssignActions';
import { formatWorkflowActor, resolveHandoverWorkflowActors } from './vehicleHandoverAssignWorkflow';
import { inspectionHandoverStageLabel } from './vehicleInspectionHandoverWorkflow';

const TERMINAL_SERVICE_STAGES = new Set(['complete', 'rejected']);

const STAGE_ASSIGNEE_LABEL = {
    pending_hr: 'HR',
    pending_accounts: 'Accounts',
    pending_admin: 'Asset Controller',
    pending_admin_officer: 'Admin Officer',
    pending_management: 'Management',
    pending_admin_return: 'Asset Controller',
    on_service: 'Asset Controller',
    scheduled_service: 'Asset Controller',
    target: 'Assignee',
    hod: 'HOD',
    hr: 'HR',
    management: 'Management',
};

function formatEmployeeRef(ref) {
    if (!ref || typeof ref !== 'object') return '';
    const name = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
    return name || String(ref.employeeId || '').trim();
}

function resolveStageAssigneeLabel(stage) {
    const key = String(stage || '').toLowerCase().trim();
    return STAGE_ASSIGNEE_LABEL[key] || '';
}

function dedupeKey(item) {
    return `${item.kind}|${item.label}|${item.pendingFor}`;
}

function hasActiveHandoverContext(asset) {
    const handoverFlow = asset?.pendingActionDetails?.vehicleHandoverFlow;
    return !!(
        asset?.assignedTo ||
        asset?.assignedCompany ||
        asset?.actionRequiredBy ||
        handoverFlow?.historyId
    );
}

/**
 * True only when a real handover workflow is in progress — not the schema default
 * `acceptanceStatus: Pending` on unassigned / inactive fleet rows.
 */
function isHandoverStillBlocking(asset) {
    const acceptance = String(asset?.acceptanceStatus || '').trim();
    const handoverFlow = asset?.pendingActionDetails?.vehicleHandoverFlow;
    const pendingAction = String(asset?.pendingAction || '').trim();
    const status = String(asset?.status || '').trim();
    const hasAssignee = !!(asset?.assignedTo || asset?.assignedCompany);

    if (isInspectionAwaitingHr(asset)) return true;

    if (handoverFlow?.stage && acceptance !== 'Accepted' && hasActiveHandoverContext(asset)) {
        return true;
    }

    if (
        acceptance === 'Pending' &&
        !pendingAction &&
        hasAssignee &&
        (status === 'Pending' || status === 'Assigned')
    ) {
        return true;
    }

    return false;
}

function resolveLinkedHandoverHistoryEntry(asset, options = {}) {
    if (options?.historyEntry) return options.historyEntry;

    const linkedId = asset?.pendingActionDetails?.vehicleHandoverFlow?.historyId;
    const history = Array.isArray(options?.assetHistory) ? options.assetHistory : [];
    if (!linkedId || !history.length) return null;

    return history.find((entry) => String(entry?._id || '') === String(linkedId)) || null;
}

function resolveHandoverWorkflowActorOptions(options = {}) {
    return {
        flowchartAdminRow: options?.flowchartAdminRow ?? null,
        flowchartHrRow: options?.flowchartHrRow ?? null,
        hrActiveHolder: options?.hrActiveHolder ?? null,
    };
}

function resolveHandoverTargetStagePendingName(asset, historyEntry = null, options = {}) {
    const workflowOptions = resolveHandoverWorkflowActorOptions(options);
    const actors = resolveHandoverWorkflowActors({
        vehicle: asset,
        historyEntry,
        ...workflowOptions,
    });

    const assigneeRef =
        historyEntry?.assignedTo ||
        asset?.assignedTo ||
        historyEntry?.assignedCompany ||
        asset?.assignedCompany ||
        null;
    const assigneeType = historyEntry?.assignedToType || asset?.assignedToType || 'Employee';
    const canSelf = getHandoverAssigneeCanSelfAcknowledge(asset, assigneeRef, historyEntry);

    if (canSelf) {
        return (
            formatWorkflowActor(null, assigneeRef, assigneeType) ||
            actors.targetedUserActor ||
            actors.adminActorName ||
            'Admin Officer'
        );
    }

    const workflowTargetName = formatWorkflowActor(
        historyEntry?.details?.vehicleHandoverWorkflow?.stages?.target,
    );
    return workflowTargetName || actors.adminActorName || actors.targetedUserActor || 'Admin Officer';
}

/** Matches handover tracking line — target user when they can self-acknowledge, else admin officer. */
function resolveHandoverNextActorName(asset, stage, historyEntry = null, options = {}) {
    const handoverFlow = asset?.pendingActionDetails?.vehicleHandoverFlow;
    const fromFlow = String(handoverFlow?.currentActorName || handoverFlow?.pendingActorName || '').trim();
    if (fromFlow) return fromFlow;

    const stageKey = String(stage || handoverFlow?.stage || '').toLowerCase().trim();
    const normalizedStage = stageKey === 'hod' ? 'hr' : stageKey;
    const workflowOptions = resolveHandoverWorkflowActorOptions(options);

    const actors = resolveHandoverWorkflowActors({
        vehicle: asset,
        historyEntry,
        ...workflowOptions,
    });

    if (normalizedStage === 'target') {
        return resolveHandoverTargetStagePendingName(asset, historyEntry, options);
    }

    if (normalizedStage === 'hr' || normalizedStage === 'management') {
        return actors.hrActor || formatEmployeeRef(asset?.actionRequiredBy) || 'HR';
    }

    return (
        formatEmployeeRef(asset?.actionRequiredBy) ||
        resolveStageAssigneeLabel(normalizedStage) ||
        getVehicleListWaitingLabel(asset) ||
        '—'
    );
}

function resolveHandoverPendingFor(asset, stage, historyEntry = null, options = {}) {
    return resolveHandoverNextActorName(asset, stage, historyEntry, options);
}

function isInspectionAwaitingHr(asset) {
    return String(asset?.vehicleInspectionStatus || '').toLowerCase() === 'pending_hr';
}

function resolveInspectionHandoverPendingItem(vehicle, historyEntry, options = {}) {
    if (!vehicle || !historyEntry) return null;
    if (!isVehicleInspectionHandoverEntry(historyEntry, vehicle)) return null;

    const status = getHandoverDisplayStatus(historyEntry, vehicle);
    if (status?.key !== 'pending') return null;

    const inspStatus = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    const workflowOptions = resolveHandoverWorkflowActorOptions(options);
    const actors = resolveHandoverWorkflowActors({
        vehicle,
        historyEntry,
        ...workflowOptions,
    });

    if (inspStatus === 'pending_hr') {
        return {
            kind: 'handover',
            label: 'Inspection approval',
            pendingFor: actors.hrActor || 'HR',
            inspectionHrPending: true,
        };
    }

    if (inspStatus === 'draft') {
        return {
            kind: 'handover',
            label: 'Inspection handover',
            pendingFor: resolveHandoverTargetStagePendingName(vehicle, historyEntry, options),
        };
    }

    return {
        kind: 'handover',
        label: 'Inspection handover',
        pendingFor: inspectionHandoverStageLabel(vehicle, historyEntry) || '—',
    };
}

function resolveHandoverPendingItem(asset, options = {}) {
    if (!isHandoverStillBlocking(asset)) return null;

    const historyEntry = resolveLinkedHandoverHistoryEntry(asset, options);
    const inspectionPending = resolveInspectionHandoverPendingItem(asset, options?.historyEntry || historyEntry, options);
    if (inspectionPending) return inspectionPending;

    if (isInspectionAwaitingHr(asset)) {
        const actors = resolveHandoverWorkflowActors({
            vehicle: asset,
            historyEntry,
            ...resolveHandoverWorkflowActorOptions(options),
        });
        return {
            kind: 'handover',
            label: 'Inspection approval',
            pendingFor: actors.hrActor || 'HR',
            inspectionHrPending: true,
        };
    }

    const { assetHistory = [] } = options || {};
    const pendingAction = String(asset.pendingAction || '').trim();
    const acceptance = String(asset.acceptanceStatus || '').trim();
    const handoverFlow = asset?.pendingActionDetails?.vehicleHandoverFlow;
    const stage = handoverFlow?.stage ? String(handoverFlow.stage).toLowerCase() : 'target';
    const dayInfoOpts = { assetHistory };

    if (handoverFlow?.stage && acceptance !== 'Accepted') {
        const dayInfo =
            stage === 'target' ? getHandoverEscalationDayInfo(asset, historyEntry, dayInfoOpts) : null;
        return {
            kind: 'handover',
            label: stage === 'target' ? 'Handover acknowledgment' : 'Handover approval',
            pendingFor: resolveHandoverPendingFor(asset, stage, historyEntry, options),
            dayInfo,
        };
    }

    if (acceptance === 'Pending' && !pendingAction) {
        const dayInfo = getHandoverEscalationDayInfo(asset, historyEntry, dayInfoOpts);
        return {
            kind: 'handover',
            label: 'Handover acknowledgment',
            pendingFor: resolveHandoverPendingFor(asset, 'target', historyEntry, options),
            dayInfo,
        };
    }

    return {
        kind: 'handover',
        label: 'Handover approval',
        pendingFor: resolveHandoverPendingFor(asset, stage, historyEntry, options),
    };
}

function collectNonHandoverPendingItems(asset) {
    const items = [];
    const seen = new Set();
    const push = (item) => {
        const pendingFor = String(item.pendingFor || '').trim() || '—';
        const next = { ...item, pendingFor };
        const key = dedupeKey(next);
        if (seen.has(key)) return;
        seen.add(key);
        items.push(next);
    };

    const pendingAction = String(asset.pendingAction || '').trim();
    if (pendingAction) {
        push({
            kind: 'workflow',
            label: pendingAction,
            pendingFor: formatEmployeeRef(asset.actionRequiredBy) || 'HR',
        });
    }

    const wf = asset.activeServiceWorkflow || {};
    const wfStage = String(wf.stage || '').toLowerCase().trim();
    const activeServiceId = normalizeMongoId(wf.serviceRecordId);

    if (wfStage && !TERMINAL_SERVICE_STAGES.has(wfStage)) {
        push({
            kind: 'service',
            label: `${String(wf.serviceTypeLabel || 'Service').trim()} service`,
            pendingFor:
                String(wf.currentAssignee?.displayName || '').trim() ||
                resolveStageAssigneeLabel(wfStage) ||
                '—',
        });
    }

    const serviceRows = buildVehicleServiceListRows(asset.services, asset);
    for (const row of serviceRows) {
        if (
            resolveVehicleServiceListRowTone(row, { activeServiceWorkflow: asset.activeServiceWorkflow }) !==
            'working'
        ) {
            continue;
        }

        const rowServiceId = normalizeMongoId(row.serviceId);
        if (activeServiceId && rowServiceId === activeServiceId) continue;

        const stage = String(
            row.workflowStage ||
                row.workflowSnapshot?.stage ||
                row.remarkParsed?.workflowStage ||
                row.remarkParsed?.stage ||
                '',
        )
            .toLowerCase()
            .trim();

        push({
            kind: 'service',
            label: `${String(row.serviceType || 'Service').trim()} service`,
            pendingFor:
                String(row.workflowSnapshot?.currentAssignee?.displayName || '').trim() ||
                resolveStageAssigneeLabel(stage) ||
                '—',
        });
    }

    return items;
}

/**
 * Pending service / handover / fleet workflow items for the vehicle profile header.
 * Handover must complete before other pending lines (e.g. service → Accounts) are shown.
 * @returns {Array<{ kind: 'service'|'handover'|'workflow', label: string, pendingFor: string, dayInfo?: object }>}
 */
export function collectVehicleProfilePendingItems(asset, options = {}) {
    if (!asset) return [];

    if (isHandoverStillBlocking(asset)) {
        const handoverItem = resolveHandoverPendingItem(asset, options);
        return handoverItem ? [handoverItem] : [];
    }

    return collectNonHandoverPendingItems(asset);
}

/** Display: "Handover pending — NESMI NESMI" / "Oil Service pending — Accounts" */
export function formatVehicleProfilePendingStatusText(item) {
    if (!item) return '';
    if (item.inspectionHrPending) {
        return 'Awaiting HR approval';
    }
    const name = String(item.pendingFor || '').trim() || '—';

    if (item.kind === 'handover') {
        const daySuffix = item.dayInfo ? ` (${formatHandoverEscalationDayLabel(item.dayInfo)})` : '';
        return `Handover pending${daySuffix} — ${name}`;
    }

    if (item.kind === 'service') {
        let serviceType = String(item.label || 'Service').trim();
        serviceType = serviceType.replace(/\s+service$/i, '').trim() || 'Service';
        return `${serviceType} pending — ${name}`;
    }

    const label = String(item.label || 'Request').trim();
    return `${label} pending — ${name}`;
}

/** Pending assignee for the handover details page header. */
export function resolveHandoverDetailPendingItem(vehicle, historyEntry = null, options = {}) {
    if (!vehicle) return null;

    const { assetHistory = [] } = options || {};

    const inspectionPending = resolveInspectionHandoverPendingItem(vehicle, historyEntry);
    if (inspectionPending) return inspectionPending;

    const profileHandover = collectVehicleProfilePendingItems(vehicle, {
        assetHistory,
        historyEntry,
    }).find((item) => item.kind === 'handover');
    if (profileHandover) return profileHandover;

    const status = historyEntry ? getHandoverDisplayStatus(historyEntry, vehicle) : null;
    if (status?.key !== 'pending') return null;

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);

    const pendingFor = resolveHandoverNextActorName(vehicle, stage, historyEntry, options);

    return {
        kind: 'handover',
        label: stage === 'target' ? 'Handover acknowledgment' : 'Handover approval',
        pendingFor,
        dayInfo:
            stage === 'target'
                ? getHandoverEscalationDayInfo(vehicle, historyEntry, { assetHistory })
                : null,
    };
}
