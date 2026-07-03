import {
    normalizeMongoId,
    parseVehicleServiceRemark,
    vehicleServiceTypeKey,
} from '../components/vehicleServiceUtils';
import { isCompletedShopServiceHistoryRecord } from './vehicleShopWorkStatus';
import { buildMechanicalWorkPreviousHistoryDetailHref } from './vehicleMechanicalWorkPreviousHistory';

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

function normId(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return normalizeMongoId(raw) || raw;
}

function resolveDriverMatchIds(employeeId, employees = []) {
    const ids = new Set();
    const raw = String(employeeId || '').trim();
    if (!raw) return ids;

    ids.add(normId(raw));

    const list = Array.isArray(employees) ? employees : [];
    const match = list.find(
        (emp) =>
            normId(emp?._id) === normId(raw) ||
            normId(emp?.id) === normId(raw) ||
            String(emp?.employeeId || '').trim().toLowerCase() === raw.toLowerCase(),
    );

    if (match?._id) ids.add(normId(match._id));
    if (match?.id) ids.add(normId(match.id));
    if (match?.employeeId) ids.add(String(match.employeeId).trim().toLowerCase());

    return ids;
}

function rowDriverCandidateIds(row) {
    const remark = parseVehicleServiceRemark({ remark: row?.remark }) || {};
    return [
        remark.carDrivenByEmployeeId,
        remark.vehicleOwnerEmployeeId,
        row?.carDrivenByEmployeeId,
        row?.vehicleOwnerEmployeeId,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);
}

function rowMatchesDriver(row, driverMatchIds) {
    if (!driverMatchIds.size) return false;
    return rowDriverCandidateIds(row).some((candidate) => {
        const mongo = normId(candidate);
        const lower = candidate.toLowerCase();
        return driverMatchIds.has(mongo) || driverMatchIds.has(lower);
    });
}

function isCompletedMechanicalWorkRow(row, asset) {
    const remark = parseVehicleServiceRemark({ remark: row?.remark }) || {};
    const requestStatus = String(remark.requestStatus || row?.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'pending') return false;

    return isCompletedShopServiceHistoryRecord(
        {
            _id: row?.serviceId ?? row?._id,
            remark: row?.remark,
            workflowSnapshot: row?.workflowSnapshot,
        },
        asset,
    );
}

export function resolveMechanicalWorkCarDrivenBy(service, asset, employees = []) {
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
    const match = list.find(
        (emp) =>
            normId(emp?._id) === normId(idStr) ||
            normId(emp?.id) === normId(idStr) ||
            String(emp?.employeeId || '').trim().toLowerCase() === idStr.toLowerCase(),
    );
    const name = employeeNameFromRecord(match);
    return { employeeId: idStr, name: name || 'Driver' };
}

function fleetRowFromAssetService(service, asset) {
    const plate = [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim();
    const vehicleLabel = plate || asset?.name || asset?.assetId || String(asset?._id || 'Vehicle');

    return {
        serviceId: service._id,
        serviceType: service.serviceType,
        date: service.date || service.createdAt,
        remark: service.remark,
        currentKm: service.currentKm,
        workflowSnapshot: service.workflowSnapshot,
        vehicleId: asset._id,
        vehicleAssetId: asset.assetId,
        vehicleLabel,
    };
}

function mapHistoryEntry(row) {
    const remark = parseVehicleServiceRemark({ remark: row.remark }) || {};
    const vehicleId = normalizeMongoId(row.vehicleId);
    const serviceId = normalizeMongoId(row.serviceId);
    return {
        id: `${vehicleId}-${serviceId}`,
        dateLabel: formatShortDate(row.date),
        kmLabel: formatKm(remark.currentKm ?? row.currentKm ?? remark.previousChangeKm),
        vehicleLabel: row.vehicleLabel || row.vehicleAssetId || 'Vehicle',
        detailHref: buildMechanicalWorkPreviousHistoryDetailHref(vehicleId, serviceId),
        sortDate: row.date ? new Date(row.date).getTime() : 0,
    };
}

export function buildMechanicalWorkDriverHistoryEntries(
    fleetRows,
    employeeId,
    { limit = 8, asset = null, employees = [] } = {},
) {
    const driverMatchIds = resolveDriverMatchIds(employeeId, employees);
    if (!driverMatchIds.size) return [];

    const seen = new Set();
    const candidates = [];

    const consider = (row) => {
        if (!row) return;
        if (vehicleServiceTypeKey(row) !== 'Mechanical Work') return;
        if (!rowMatchesDriver(row, driverMatchIds)) return;
        if (!isCompletedMechanicalWorkRow(row, asset)) return;

        const serviceId = normalizeMongoId(row.serviceId ?? row._id);
        const vehicleId = normalizeMongoId(row.vehicleId);
        const key = `${vehicleId}-${serviceId}`;
        if (!serviceId || !vehicleId || seen.has(key)) return;

        seen.add(key);
        candidates.push(row);
    };

    (Array.isArray(fleetRows) ? fleetRows : []).forEach(consider);

    if (asset && Array.isArray(asset.services)) {
        asset.services.forEach((service) => {
            consider(fleetRowFromAssetService(service, asset));
        });
    }

    return candidates
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, limit)
        .map(mapHistoryEntry);
}
