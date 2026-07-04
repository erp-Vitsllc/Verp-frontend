import {
    buildVehicleServiceListRows,
    normalizeMongoId,
    resolveVehicleServiceListRowTone,
} from '../components/vehicleServiceUtils';
import { getVehicleListWaitingLabel } from '../components/vehicleAssetStatusUi';
import { fmtHandoverPerson } from './vehicleHandoverHistory';

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
};

function formatEmployeeRef(ref) {
    if (!ref || typeof ref !== 'object') return '';
    const name = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
    return name || String(ref.employeeId || '').trim();
}

function resolveAssigneeName(asset) {
    if (String(asset?.assignedToType || '').toLowerCase() === 'company' && asset?.assignedCompany) {
        const company = asset.assignedCompany;
        if (typeof company === 'object') {
            return (
                company.nickName ||
                company.companyShortName ||
                company.name ||
                company.companyName ||
                ''
            );
        }
        return String(company).trim();
    }
    return fmtHandoverPerson(asset?.assignedTo);
}

function resolveStageAssigneeLabel(stage) {
    const key = String(stage || '').toLowerCase().trim();
    return STAGE_ASSIGNEE_LABEL[key] || '';
}

function dedupeKey(item) {
    return `${item.kind}|${item.label}|${item.pendingFor}`;
}

/**
 * Pending service / handover / fleet workflow items for the vehicle profile header.
 * @returns {Array<{ kind: 'service'|'handover'|'workflow', label: string, pendingFor: string }>}
 */
export function collectVehicleProfilePendingItems(asset) {
    if (!asset) return [];

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

    const acceptance = String(asset.acceptanceStatus || '').trim();
    if (acceptance === 'Pending' && !pendingAction) {
        push({
            kind: 'handover',
            label: 'Handover acknowledgment',
            pendingFor:
                formatEmployeeRef(asset.actionRequiredBy) ||
                resolveAssigneeName(asset) ||
                getVehicleListWaitingLabel(asset) ||
                'Assignee',
        });
    }

    const handoverFlow = asset.pendingActionDetails?.vehicleHandoverFlow;
    if (handoverFlow?.stage && acceptance !== 'Accepted') {
        const stage = String(handoverFlow.stage).toLowerCase();
        push({
            kind: 'handover',
            label: 'Handover approval',
            pendingFor:
                String(handoverFlow.currentActorName || handoverFlow.pendingActorName || '').trim() ||
                formatEmployeeRef(asset.actionRequiredBy) ||
                (stage === 'target' ? resolveAssigneeName(asset) : '') ||
                resolveStageAssigneeLabel(stage) ||
                'Admin Officer',
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
