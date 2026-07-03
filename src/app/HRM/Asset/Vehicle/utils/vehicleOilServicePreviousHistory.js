import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    resolveVehicleServiceListRowTone,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';
import { resolveOilServiceWorkflowStage } from './vehicleOilServiceAccess';

function formatShortDate(value) {
    if (!value) return '—';
    const str = String(value).trim();
    let iso = str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        iso = str.slice(0, 10);
    } else if (/^\d{4}-\d{2}$/.test(str)) {
        iso = `${str}-01`;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatKm(value) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString()} km`;
}

function resolveLastChangeDate(service, remark = {}) {
    return (
        remark.serviceEndDate ||
        service?.date ||
        remark.serviceStartDate ||
        remark.scheduledServiceDate ||
        service?.updatedAt ||
        service?.createdAt ||
        (remark.nextChangeMonth ? `${remark.nextChangeMonth}-01` : null)
    );
}

function resolveLastChangeKm(service, remark = {}) {
    return (
        remark.previousChangeKm ??
        remark.lastChangeKm ??
        service?.currentKm ??
        remark.currentKm
    );
}

function isCompletedOilServiceRecord(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'pending') return false;

    if (String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live') return true;

    const stage = resolveOilServiceWorkflowStage(service, asset);
    if (stage === 'complete') return true;

    const row = {
        serviceId: normalizeMongoId(service._id),
        remark: service.remark,
        workflowSnapshot: service.workflowSnapshot,
        workflowStage: service.workflowSnapshot?.stage || null,
    };
    return resolveVehicleServiceListRowTone(row, { activeServiceWorkflow: asset?.activeServiceWorkflow }) === 'done';
}

export function buildOilServicePreviousHistoryDetailHref(vehicleId, serviceId) {
    const assetId = normalizeMongoId(vehicleId);
    const recordId = normalizeMongoId(serviceId);
    if (!assetId || !recordId) return null;
    return `/HRM/Asset/Vehicle/details/${assetId}/oil-service/${recordId}`;
}

/** Last N completed oil-change services for this vehicle (includes current when completed). */
export function buildOilServicePreviousHistoryEntries(asset, currentServiceId, { limit = 5 } = {}) {
    const services = Array.isArray(asset?.services) ? asset.services : [];
    const currentId = normalizeMongoId(currentServiceId);
    const vehicleId = normalizeMongoId(asset?._id);

    return services
        .filter((s) => vehicleServiceTypeKey(s) === 'Oil Service')
        .filter((s) => isCompletedOilServiceRecord(s, asset))
        .map((s) => {
            const remark = parseVehicleServiceRemark(s) || {};
            const rawDate = resolveLastChangeDate(s, remark);
            const entryId = normalizeMongoId(s._id);
            return {
                id: entryId,
                isCurrent: entryId === currentId,
                rawDate,
                dateLabel: formatShortDate(rawDate),
                oilType: remark.oilServiceTypeText || remark.oilType || '—',
                kmLabel: formatKm(resolveLastChangeKm(s, remark)),
                detailHref: buildOilServicePreviousHistoryDetailHref(vehicleId, s._id),
            };
        })
        .sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0))
        .slice(0, limit);
}
