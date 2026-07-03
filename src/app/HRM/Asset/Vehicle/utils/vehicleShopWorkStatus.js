import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';

export const SHOP_WORK_SERVICE_TYPES = ['Tire Change', 'Mechanical Work', 'Body Work', 'Accident Repair'];

export function isShopWorkServiceType(serviceType) {
    return SHOP_WORK_SERVICE_TYPES.includes(String(serviceType || '').trim());
}

export function isShopWorkServiceRecord(service) {
    return isShopWorkServiceType(vehicleServiceTypeKey(service));
}

function resolveShopWorkWorkflowStage(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const serviceId = normalizeMongoId(service?._id);
    const wf = asset?.activeServiceWorkflow || {};
    const wfMatch = serviceId && normalizeMongoId(wf.serviceRecordId) === serviceId;

    return String(
        service?.workflowSnapshot?.stage ||
            (wfMatch ? wf.stage : '') ||
            remark.workflowStage ||
            remark.stage ||
            '',
    )
        .toLowerCase()
        .trim();
}

function isWorkflowMatch(service, asset) {
    const serviceId = normalizeMongoId(service?._id);
    const wf = asset?.activeServiceWorkflow || {};
    return serviceId && normalizeMongoId(wf.serviceRecordId) === serviceId;
}

/** True once the scheduled start date has been reached (Tire / Mechanical / Body Work). */
export function isShopWorkServiceLive(service, asset) {
    if (!isShopWorkServiceRecord(service)) return false;
    if (!isWorkflowMatch(service, asset)) return false;

    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
    if (String(remark.shopServiceLiveAt || '').trim()) return true;
    if (wf.shopServiceLiveAt) return true;
    if (asset?.onServiceActive === true && String(wf.stage || '').toLowerCase() === 'scheduled_service') {
        return true;
    }
    return false;
}

/** Accounts approved — waiting for the service start date (Tire / Mechanical / Body Work). */
export function isShopWorkScheduledWaiting(service, asset) {
    if (!isShopWorkServiceRecord(service)) return false;
    if (!isWorkflowMatch(service, asset)) return false;

    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus !== 'submitted') return false;

    const stage = resolveShopWorkWorkflowStage(service, asset);
    if (stage !== 'scheduled_service') return false;
    return !isShopWorkServiceLive(service, asset);
}

/**
 * Service tab + detail header status for Tire Change, Mechanical Work, and Body Work:
 * Pending → Scheduled → On Service → Complete
 */
export function resolveShopWorkTableStatusLabel(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const stage = resolveShopWorkWorkflowStage(service, asset);
    const vehicleServiceDone = String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    if (requestStatus === 'draft') {
        return { label: 'Draft', tone: 'draft' };
    }
    if (requestStatus === 'pending') {
        return { label: 'Pending', tone: 'pending' };
    }
    if (stage === 'complete' || vehicleServiceDone) {
        return { label: 'Complete', tone: 'complete' };
    }
    if (stage === 'rejected') {
        return { label: 'Rejected', tone: 'rejected' };
    }
    if (isShopWorkScheduledWaiting(service, asset)) {
        return { label: 'Scheduled', tone: 'scheduled' };
    }
    if (isShopWorkServiceLive(service, asset)) {
        return { label: 'On Service', tone: 'working' };
    }

    return { label: 'Pending', tone: 'pending' };
}

export function resolveShopWorkHeaderStatus(service, asset) {
    const { label } = resolveShopWorkTableStatusLabel(service, asset);

    const toneByLabel = {
        Draft: 'bg-blue-50 border-blue-100 text-blue-700',
        Pending: 'bg-amber-50 border-amber-100 text-amber-700',
        Scheduled: 'bg-violet-50 border-violet-100 text-violet-700',
        'On Service': 'bg-amber-50 border-amber-100 text-amber-700',
        Complete: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        Rejected: 'bg-slate-50 border-slate-100 text-slate-600',
    };

    return {
        label,
        boxClass: toneByLabel[label] || 'bg-amber-50 border-amber-100 text-amber-700',
    };
}

export function resolveShopWorkApprovalStageLabel(service, asset) {
    const { label } = resolveShopWorkTableStatusLabel(service, asset);
    if (label === 'Draft') return 'Request Initiated';
    return label;
}

/** Whether the vehicle has reached the On Service phase (start date reached). */
export function isShopServiceLiveOnAsset(asset, service = null) {
    const wf = asset?.activeServiceWorkflow || {};
    if (wf.shopServiceLiveAt) return true;
    if (service && isShopWorkServiceRecord(service)) {
        return isShopWorkServiceLive(service, asset);
    }
    const remark =
        service && typeof service.remark === 'string'
            ? (() => {
                  try {
                      return JSON.parse(service.remark);
                  } catch {
                      return {};
                  }
              })()
            : {};
    if (String(remark.shopServiceLiveAt || '').trim()) return true;
    if (asset?.onServiceActive === true && String(wf.stage || '').toLowerCase() === 'scheduled_service') {
        return true;
    }
    return false;
}

/** Return / completion card — visible after Accounts approves (Scheduled) through Complete. */
export function shouldShowShopServiceReturnCard(stage) {
    const normalized = String(stage || '').toLowerCase();
    return ['scheduled_service', 'pending_admin_return', 'complete'].includes(normalized);
}

export function normalizeShopServiceDateValue(value) {
    if (value == null || String(value).trim() === '') return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/** Service end date from garage details (remark or active workflow). */
export function resolveShopServiceEndDate(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const wf = asset?.activeServiceWorkflow || {};
    const raw =
        remark.serviceEndDate ||
        remark.serviceWindowEndDate ||
        wf.serviceWindowEndDate ||
        '';
    return normalizeShopServiceDateValue(raw);
}

/** Return date defaults to service end date until explicitly saved on the return form. */
export function resolveShopServiceReturnDate(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const saved = normalizeShopServiceDateValue(remark.returnDate);
    if (saved) return saved;
    return resolveShopServiceEndDate(service, asset);
}

/** Only finished shop services belong in previous / driver history lists. */
export function isCompletedShopServiceHistoryRecord(service, asset) {
    if (!service) return false;
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'pending') return false;
    if (String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') return true;

    const stage = String(
        service?.workflowSnapshot?.stage || remark.workflowStage || remark.stage || '',
    ).toLowerCase();
    if (stage === 'complete') return true;

    const serviceId = normalizeMongoId(service?._id);
    const wf = asset?.activeServiceWorkflow || {};
    const activeMatch = serviceId && normalizeMongoId(wf.serviceRecordId) === serviceId;
    if (activeMatch) {
        const activeStage = String(wf.stage || '').toLowerCase();
        if (activeStage && activeStage !== 'complete' && activeStage !== 'rejected') {
            return false;
        }
    }

    return false;
}

export function buildShopServiceHistoryDetailHref(vehicleId, serviceId, serviceType) {
    const assetId = normalizeMongoId(vehicleId);
    const recordId = normalizeMongoId(serviceId);
    const type = String(serviceType || '').trim();
    if (!assetId || !recordId || !type) return null;
    const base = `/HRM/Asset/Vehicle/details/${assetId}`;
    if (type === 'Tire Change') return `${base}/tire-change/${recordId}`;
    if (type === 'Mechanical Work') return `${base}/mechanical-work/${recordId}`;
    if (type === 'Body Work') return `${base}/body-work/${recordId}`;
    if (type === 'Accident Repair') return `${base}/accident-repair/${recordId}`;
    return null;
}
