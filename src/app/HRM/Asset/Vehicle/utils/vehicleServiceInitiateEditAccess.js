import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

/**
 * True once Initiate Service is closed: Zoho bill accepted, or the workflow
 * is complete / rejected. Until then any signed-in user may edit it.
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

    if (['billed', 'complete', 'rejected'].includes(stage)) return true;
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
 * any signed-in user, until the Zoho bill is accepted (or the service is complete / rejected).
 */
export function canEditVehicleServiceInitiate({
    canCreateOrInitiate = false,
    service = null,
    asset = null,
} = {}) {
    if (isVehicleServiceZohoBillAccepted(service, asset)) {
        return false;
    }
    return Boolean(canCreateOrInitiate);
}

/**
 * When the service form is locked, flowchart Accounts can still edit amounts
 * and flowchart HR can still edit amounts and attachments. Completed or not.
 */
export function lockedServiceFieldAccess({
    locked = false,
    saving = false,
    isFlowchartHr = false,
    isFlowchartAccounts = false,
} = {}) {
    const hr = Boolean(isFlowchartHr);
    const accounts = Boolean(isFlowchartAccounts);
    const amountOpen = !locked || hr || accounts;
    const attachmentOpen = !locked || hr;
    return {
        amountDisabled: Boolean(saving) || !amountOpen,
        attachmentDisabled: Boolean(saving) || !attachmentOpen,
        showOverrideSave: Boolean(locked) && (hr || accounts),
    };
}
