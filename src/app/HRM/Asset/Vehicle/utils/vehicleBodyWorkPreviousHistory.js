import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';
import {
    buildShopServiceHistoryDetailHref,
    isCompletedShopServiceHistoryRecord,
} from './vehicleShopWorkStatus';

function formatShortDate(value) {
    if (!value) return '—';
    const date = new Date(value);
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

function isCompletedBodyWorkServiceRecord(service, asset) {
    return isCompletedShopServiceHistoryRecord(service, asset);
}

export function buildBodyWorkPreviousHistoryDetailHref(vehicleId, serviceId) {
    return buildShopServiceHistoryDetailHref(vehicleId, serviceId, 'Body Work');
}

export function buildBodyWorkPreviousHistoryEntries(asset, currentServiceId, { limit = 5 } = {}) {
    if (!asset) return [];
    const services = Array.isArray(asset.services) ? asset.services : [];
    const currentId = normalizeMongoId(currentServiceId);

    return services
        .filter((s) => vehicleServiceTypeKey(s) === 'Body Work')
        .filter((s) => isCompletedBodyWorkServiceRecord(s, asset))
        .filter((s) => normalizeMongoId(s._id) !== currentId)
        .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
        .slice(0, limit)
        .map((service) => {
            const remark = parseVehicleServiceRemark(service) || {};
            const serviceId = normalizeMongoId(service._id);
            return {
                id: serviceId,
                dateLabel: formatShortDate(service.date || service.createdAt),
                kmLabel: formatKm(remark.currentKm ?? service.currentKm ?? remark.previousChangeKm),
                isCurrent: serviceId === currentId,
                detailHref: buildBodyWorkPreviousHistoryDetailHref(asset._id, serviceId),
            };
        });
}
