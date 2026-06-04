import { parseServiceRemark } from './vehicleServicePayload';

function formatShortDate(isoOrDate) {
    if (!isoOrDate) return 'No history';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return 'No history';
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Latest prior completed/submitted service of a type for one vehicle (excludes current row when editing).
 */
export function getPreviousVehicleServiceDate(services, { serviceType = 'Accident Repair', excludeServiceId = null } = {}) {
    const list = Array.isArray(services) ? services : [];
    const typeNorm = String(serviceType || '').trim();

    const prior = list.filter((s) => {
        if (excludeServiceId && String(s?._id || '') === String(excludeServiceId)) return false;
        if (typeNorm && String(s?.serviceType || '').trim() !== typeNorm) return false;

        const rm = parseServiceRemark(s?.remark) || {};
        const draft = String(rm.requestStatus || '').toLowerCase() === 'draft';
        if (draft) return false;

        const completed =
            String(rm.vehicleServiceCompleted || '').toLowerCase() === 'live' ||
            String(s?.workflowSnapshot?.stage || '').toLowerCase() === 'complete' ||
            String(rm.accidentServiceStatus || '').toLowerCase() === 'complete';

        const submitted = String(rm.requestStatus || '').toLowerCase() === 'submitted';
        return completed || submitted;
    });

    if (!prior.length) {
        return { hasHistory: false, date: null, label: 'No history' };
    }

    prior.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
    const latest = prior[0];
    const d = latest?.date ? new Date(latest.date) : null;
    if (!d || Number.isNaN(d.getTime())) {
        return { hasHistory: false, date: null, label: 'No history' };
    }

    return { hasHistory: true, date: d, label: formatShortDate(d) };
}

export function vehicleServiceHistoryHref(vehicleId) {
    const id = String(vehicleId || '').trim();
    if (!id) return '/HRM/Asset/Vehicle/service-requests';
    return `/HRM/Asset/Vehicle/service-requests?vehicleId=${encodeURIComponent(id)}`;
}
