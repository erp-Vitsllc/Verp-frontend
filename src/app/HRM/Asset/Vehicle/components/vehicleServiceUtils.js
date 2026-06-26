/** Compare Mongo ObjectIds / $oid / populated shapes from JSON APIs. */
import { parseServiceRemark } from './vehicleServicePayload';

export function normalizeMongoId(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'object' && v !== null) {
        if (typeof v.$oid === 'string') return v.$oid;
        if (v._id != null) return normalizeMongoId(v._id);
    }
    return String(v).trim();
}

export function mongoIdsEqual(a, b) {
    const x = normalizeMongoId(a);
    const y = normalizeMongoId(b);
    return x !== '' && x === y;
}

/** Same list as the Service tab on vehicle details. */
export const VEHICLE_SERVICE_TYPES = [
    'Oil Service',
    'Tire Change',
    'Mechanical Work',
    'Body Work',
    'Accident Repair',
    'Car Wash',
];

export function vehicleServiceTypeKey(service) {
    if (!service) return '';
    const st = String(service.serviceType || '').trim();
    if (st) return st;
    const r = parseVehicleServiceRemark(service);
    return String(r?.serviceType || '').trim();
}

export function buildVehicleServiceListRows(services, asset, { serviceTypeFilter } = {}) {
    const list = Array.isArray(services) ? services : [];
    const vid = normalizeMongoId(asset?._id);
    const plate = [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim();
    const vehicleLabel = plate || asset?.name || asset?.assetId || vid;

    let filtered = list;
    if (serviceTypeFilter) {
        filtered = list.filter((s) => vehicleServiceTypeKey(s) === serviceTypeFilter);
    }

    return filtered
        .map((s) => {
            const remark = parseVehicleServiceRemark(s) ?? {};
            const row = {
                serviceId: normalizeMongoId(s._id),
                serviceType: vehicleServiceTypeKey(s) || '—',
                date: s.date || s.createdAt,
                value: s.value,
                requestStatus:
                    String(remark?.requestStatus || '').toLowerCase() === 'draft' ? 'draft' : 'submitted',
                vehicleId: vid,
                vehicleAssetId: asset?.assetId || '—',
                vehicleLabel,
                attachment: s.attachment || null,
                quotation2: s.quotation2 || null,
                quotation3: s.quotation3 || null,
                invoice: s.invoice || null,
                workflowStage: s.workflowSnapshot?.stage || null,
                workflowSnapshot: s.workflowSnapshot || null,
                remarkParsed: remark,
                remark: s.remark || '',
            };
            return {
                ...row,
                rowTone: resolveVehicleServiceListRowTone(row, {
                    activeServiceWorkflow: asset?.activeServiceWorkflow,
                }),
            };
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export function serviceCountByType(services) {
    const counts = Object.fromEntries(VEHICLE_SERVICE_TYPES.map((t) => [t, 0]));
    for (const s of services || []) {
        const key = vehicleServiceTypeKey(s);
        if (key && counts[key] != null) counts[key] += 1;
    }
    return counts;
}

/** `working` = in-progress service (yellow row); `done` = completed (white row). */
export function resolveVehicleServiceListRowTone(row, { activeServiceWorkflow } = {}) {
    const remark =
        row?.remarkParsed ??
        (typeof row?.remark === 'string' ? parseServiceRemark(row.remark) : null) ??
        parseVehicleServiceRemark(row) ??
        {};

    const requestStatus = String(row?.requestStatus ?? remark?.requestStatus ?? '').toLowerCase();
    if (requestStatus === 'draft') return 'working';

    const serviceId = normalizeMongoId(row?.serviceId ?? row?._id);
    const activeWf = activeServiceWorkflow || row?.activeServiceWorkflow;
    const activeMatch =
        activeWf &&
        serviceId &&
        normalizeMongoId(activeWf.serviceRecordId) === serviceId;

    const stage = String(
        row?.workflowStage ||
            row?.workflowSnapshot?.stage ||
            (activeMatch ? activeWf?.stage : '') ||
            remark?.workflowStage ||
            remark?.stage ||
            '',
    )
        .toLowerCase()
        .trim();

    const vehicleServiceDone = String(remark?.vehicleServiceCompleted || '').toLowerCase();
    const accidentStatus = String(remark?.accidentServiceStatus || '')
        .toLowerCase()
        .replace(/\s+/g, '_');
    const serviceStatus = String(remark?.serviceStatus || '')
        .toLowerCase()
        .replace(/\s+/g, '_');

    const isDone =
        stage === 'complete' ||
        vehicleServiceDone === 'live' ||
        accidentStatus === 'complete' ||
        serviceStatus === 'complete' ||
        serviceStatus === 'completed';

    if (isDone || stage === 'rejected') return 'done';
    if (stage && !['complete', 'rejected'].includes(stage)) return 'working';

    if (
        requestStatus === 'submitted' &&
        activeMatch &&
        activeWf?.stage &&
        !['complete', 'rejected'].includes(String(activeWf.stage).toLowerCase())
    ) {
        return 'working';
    }

    return 'done';
}

export function vehicleServiceListRowClassName(tone) {
    if (tone === 'working') {
        return 'bg-amber-50 hover:bg-amber-100/90 border-b border-amber-100/80';
    }
    return 'bg-white hover:bg-slate-50 border-b border-slate-100';
}

/**
 * Service `remark` is stored as JSON on the asset (Oil / Tire / Car Wash schedule, mechanical meta, etc.).
 */
export function parseVehicleServiceRemark(srv) {
    if (!srv?.remark || typeof srv.remark !== 'string') return null;
    try {
        return JSON.parse(srv.remark);
    } catch {
        return null;
    }
}

/** `nextChangeMonth` from `<input type="month" />` e.g. "2026-04" */
export function formatNextChangeMonthDisplay(ym) {
    if (!ym || String(ym).trim() === '') return '—';
    const str = String(ym).trim();
    const m = str.match(/^(\d{4})-(\d{1,2})/);
    if (!m) return str;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (!y || !mo) return str;
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
