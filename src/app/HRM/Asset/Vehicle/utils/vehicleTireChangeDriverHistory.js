import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';
import { buildTireChangePreviousHistoryDetailHref } from './vehicleTireChangePreviousHistory';

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

function employeeNameFromRecord(emp) {
    if (!emp || typeof emp !== 'object') return '';
    return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || '';
}

export function resolveTireChangeCarDrivenBy(service, asset, employees = []) {
    const remark = parseVehicleServiceRemark(service) || {};
    const employeeId =
        remark.carDrivenByEmployeeId ||
        remark.vehicleOwnerEmployeeId ||
        (asset?.assignedTo?._id || asset?.assignedTo);

    const idStr = employeeId ? String(employeeId) : '';
    if (!idStr) return { employeeId: '', name: 'Driver' };

    const assignee = asset?.assignedTo;
    if (assignee && typeof assignee === 'object' && String(assignee._id) === idStr) {
        const name = employeeNameFromRecord(assignee);
        if (name) return { employeeId: idStr, name };
    }

    const list = Array.isArray(employees) ? employees : [];
    const match = list.find((emp) => String(emp._id) === idStr);
    const name = employeeNameFromRecord(match);
    return { employeeId: idStr, name: name || 'Driver' };
}

function rowCarDrivenByEmployeeId(row) {
    const remark = parseVehicleServiceRemark({ remark: row?.remark }) || {};
    return String(remark.carDrivenByEmployeeId || remark.vehicleOwnerEmployeeId || '').trim();
}

export function buildTireChangeDriverHistoryEntries(fleetRows, employeeId, { limit = 8, excludeServiceId } = {}) {
    const driverId = String(employeeId || '').trim();
    if (!driverId) return [];

    const excludeId = normalizeMongoId(excludeServiceId);

    return (Array.isArray(fleetRows) ? fleetRows : [])
        .filter((row) => vehicleServiceTypeKey(row) === 'Tire Change')
        .filter((row) => rowCarDrivenByEmployeeId(row) === driverId)
        .filter((row) => !excludeId || normalizeMongoId(row.serviceId) !== excludeId)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, limit)
        .map((row) => {
            const remark = parseVehicleServiceRemark({ remark: row.remark }) || {};
            const vehicleId = normalizeMongoId(row.vehicleId);
            const serviceId = normalizeMongoId(row.serviceId);
            return {
                id: `${vehicleId}-${serviceId}`,
                dateLabel: formatShortDate(row.date),
                kmLabel: formatKm(remark.currentKm ?? row.currentKm ?? remark.previousChangeKm),
                vehicleLabel: row.vehicleLabel || row.vehicleAssetId || 'Vehicle',
                detailHref: buildTireChangePreviousHistoryDetailHref(vehicleId, serviceId),
            };
        });
}
