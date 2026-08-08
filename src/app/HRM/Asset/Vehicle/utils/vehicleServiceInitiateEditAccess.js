import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

/**
 * True once Zoho garage/oil bill create succeeded (Billed).
 * Until then HR may edit Initiate Service (shop + oil).
 */
export function isVehicleServiceZohoBillAccepted(service, asset = null) {
    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch =
        !wf?.serviceRecordId ||
        String(wf.serviceRecordId) === String(service?._id || service?.id || '');
    const stage = String(
        remark.workflowStage || remark.stage || (wfMatch ? wf.stage : '') || '',
    )
        .toLowerCase()
        .trim();

    if (stage === 'billed') return true;
    if (String(remark.billingStatus || '').toLowerCase() === 'billed') return true;
    if (String(remark.zohoBillId || '').trim()) return true;

    const multi = Array.isArray(remark.zohoBills) ? remark.zohoBills : [];
    if (
        multi.length > 0 &&
        multi.every((bill) => String(bill?.zohoBillId || '').trim())
    ) {
        return true;
    }

    return false;
}

/**
 * Who may edit Initiate Service fields:
 * - Draft / pending: existing create/initiate actors
 * - After Send, until Zoho billed: flowchart HR only
 */
export function canEditVehicleServiceInitiate({
    assignmentPending = false,
    canCreateOrInitiate = false,
    isFlowchartHr = false,
    service = null,
    asset = null,
} = {}) {
    if (assignmentPending) {
        return Boolean(canCreateOrInitiate);
    }
    if (isVehicleServiceZohoBillAccepted(service, asset)) {
        return false;
    }
    return Boolean(isFlowchartHr);
}
