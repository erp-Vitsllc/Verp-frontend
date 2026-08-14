/** Compare Mongo ObjectIds / $oid / populated shapes from JSON APIs. */
import { parseServiceRemark } from './vehicleServicePayload';
import { resolveOilServiceTableStatusLabel } from '../utils/vehicleOilServiceAccess';
import { oilPaymentTypeLabel, normalizeOilPaymentType } from '../utils/vehicleOilServiceDetailForm';

/**
 * Amount Type + Amount Status for Service tab tables (Zoho-linked Cash path).
 * - Amount Type: Cash / Warranty (from remark.amountMode)
 * - Amount Status: Pending | Not Paid | Paid
 *   Pending  = Cash path, Zoho bill not created yet
 *   Not Paid = Zoho bill created (open), vendor payment outstanding
 *   Paid     = Zoho vendor payment settled (remark.zohoPaymentStatus=paid or Zoho bill paid)
 *   Warranty = "—" (no Zoho payment)
 */
function collectRemarkZohoBillIds(remark = {}) {
    const ids = new Set();
    const push = (value) => {
        const id = String(value || '').trim();
        if (id) ids.add(id);
    };
    push(remark?.zohoBillId);
    for (const row of Array.isArray(remark?.zohoBills) ? remark.zohoBills : []) {
        push(row?.zohoBillId || row?.bill_id || row?.billId);
    }
    return [...ids];
}

function remarkHasZohoBillLink(remark = {}) {
    if (collectRemarkZohoBillIds(remark).length) return true;
    const multi = Array.isArray(remark?.zohoBills) ? remark.zohoBills : [];
    if (multi.some((row) => String(row?.zohoBillNumber || row?.billNumber || '').trim())) return true;
    return Boolean(String(remark?.zohoBillNumber || '').trim());
}

function remarkZohoBillsAllPaid(remark = {}) {
    const multi = Array.isArray(remark?.zohoBills) ? remark.zohoBills.filter(Boolean) : [];
    if (multi.length >= 1) {
        return multi.every((row) => {
            const st = String(row?.zohoBillStatus || row?.status || '').toLowerCase();
            return st === 'paid';
        });
    }
    return false;
}

export function resolveServiceAmountTypeAndStatus(serviceOrRemark) {
    const remark =
        serviceOrRemark && typeof serviceOrRemark === 'object' && !serviceOrRemark.remark
            ? serviceOrRemark
            : parseVehicleServiceRemark(serviceOrRemark) || {};
    const amountMode = normalizeOilPaymentType(remark.amountMode) || String(remark.amountMode || '').toLowerCase();
    const amountType = amountMode === 'warranty' ? 'Warranty' : oilPaymentTypeLabel(amountMode || 'amount') || 'Cash';

    if (amountMode === 'warranty') {
        return { amountType: 'Warranty', amountStatus: '—', amountStatusTone: 'na' };
    }

    const billingStatus = String(remark.billingStatus || '').toLowerCase();
    const zohoPaymentStatus = String(remark.zohoPaymentStatus || '').toLowerCase();
    const zohoBillStatus = String(remark.zohoBillStatus || '').toLowerCase();
    const carWashPay = String(remark.carWashPaymentStatus || '').toLowerCase();
    const hasZohoBill = remarkHasZohoBillLink(remark);

    if (
        zohoPaymentStatus === 'paid' ||
        zohoBillStatus === 'paid' ||
        carWashPay === 'paid' ||
        billingStatus === 'paid' ||
        remarkZohoBillsAllPaid(remark)
    ) {
        return { amountType, amountStatus: 'Paid', amountStatusTone: 'paid' };
    }

    if (hasZohoBill || billingStatus === 'billed' || carWashPay === 'billed') {
        return { amountType, amountStatus: 'Not Paid', amountStatusTone: 'not_paid' };
    }

    return { amountType, amountStatus: 'Pending', amountStatusTone: 'pending' };
}

export function serviceAmountStatusBadgeClass(tone) {
    if (tone === 'paid') return 'bg-emerald-100 text-emerald-800';
    if (tone === 'not_paid') return 'bg-amber-100 text-amber-900';
    if (tone === 'pending') return 'bg-slate-100 text-slate-700';
    return 'bg-transparent text-slate-400';
}

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

/** Service tab types that use the same pending-request flow as Oil Service (not Car Wash). */
export const VEHICLE_SERVICE_TAB_REQUEST_TYPES = [
    'Tire Change',
    'Mechanical Work',
    'Body Work',
    'Accident Repair',
];

export function isVehicleServiceTabRequestType(serviceType) {
    return VEHICLE_SERVICE_TAB_REQUEST_TYPES.includes(String(serviceType || '').trim());
}

/** End date for Service tab list sorting (service end / return / window end). */
export function resolveVehicleServiceListEndDate(service, asset = null) {
    if (!service) return null;
    const remark = parseVehicleServiceRemark(service) || {};
    const serviceId = normalizeMongoId(service._id);
    const wf = asset?.activeServiceWorkflow;
    const wfMatch = serviceId && wf && normalizeMongoId(wf.serviceRecordId) === serviceId;
    const snap = service?.workflowSnapshot || {};

    const raw =
        remark.serviceEndDate ||
        remark.returnDate ||
        remark.nextChangeMonth ||
        (wfMatch ? wf.serviceWindowEndDate : null) ||
        snap.serviceWindowEndDate ||
        null;
    if (raw == null || raw === '') return null;
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}$/.test(str)) return `${str}-01`;
    return str;
}

function serviceListEndDateMs(value) {
    if (value == null || value === '') return Number.POSITIVE_INFINITY;
    const str = String(value).trim();
    const d = /^\d{4}-\d{2}$/.test(str) ? new Date(`${str}-01`) : new Date(str);
    if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
    return d.getTime();
}

/** Completed / closed rows sink to the bottom of the Service tab list. */
function isServiceListRowCompleted(row) {
    const tone = String(row?.statusTone || '').toLowerCase();
    return tone === 'complete' || tone === 'rejected';
}

/**
 * Service tab list order: pending (open) first, completed last;
 * within each group sort by end date ascending (earliest first).
 */
export function compareVehicleServiceListRows(a, b) {
    const aDone = isServiceListRowCompleted(a);
    const bDone = isServiceListRowCompleted(b);
    if (aDone !== bDone) return aDone ? 1 : -1;

    const ea = serviceListEndDateMs(a?.sortEndDate ?? a?.endDate ?? a?.nextOilServiceDate);
    const eb = serviceListEndDateMs(b?.sortEndDate ?? b?.endDate ?? b?.nextOilServiceDate);
    if (ea !== eb) return ea - eb;

    const ta = a?.sortDate ? new Date(a.sortDate).getTime() : 0;
    const tb = b?.sortDate ? new Date(b.sortDate).getTime() : 0;
    return tb - ta;
}

/** Chronology for vehicle Service tab SL: oldest service = SL 1. */
function vehicleServiceChronologyMs(row) {
    const candidates = [row?.createdAt, row?.requestDate, row?.date];
    for (const c of candidates) {
        if (c == null || c === '') continue;
        const t = new Date(c).getTime();
        if (Number.isFinite(t)) return t;
    }
    const id = normalizeMongoId(row?.serviceId || row?.id);
    if (/^[a-f0-9]{24}$/i.test(id)) {
        return parseInt(id.slice(0, 8), 16) * 1000;
    }
    return 0;
}

/**
 * Assign SL 1 to the first (oldest) service, then return rows with largest SL first.
 */
export function assignAndSortByVehicleServiceSl(rows) {
    const list = Array.isArray(rows) ? [...rows] : [];
    list.sort((a, b) => {
        const ta = vehicleServiceChronologyMs(a);
        const tb = vehicleServiceChronologyMs(b);
        if (ta !== tb) return ta - tb;
        return String(normalizeMongoId(a?.serviceId || a?.id)).localeCompare(
            String(normalizeMongoId(b?.serviceId || b?.id)),
        );
    });
    const withSl = list.map((row, idx) => ({ ...row, slNo: idx + 1 }));
    withSl.sort((a, b) => (Number(b.slNo) || 0) - (Number(a.slNo) || 0));
    return withSl;
}

/**
 * Service-tab "Next service" banner: only the latest oil request, and only after
 * that request is completed. Open / initiated visits must not show an older due date.
 */
export function latestOilServiceBannerNextDate(asset) {
    const rows = buildOilServiceRequestRowsFromAsset(asset);
    if (!rows.length) return null;
    const latest = rows[0];
    if (String(latest?.statusTone || '').toLowerCase() !== 'complete') return null;
    return latest.nextOilServiceDate || null;
}

export function vehicleServiceTypeKey(service) {
    if (!service) return '';
    const st = String(service.serviceType || '').trim();
    if (st) return st;
    const r = parseVehicleServiceRemark(service);
    return String(r?.serviceType || '').trim();
}

export function vehicleServiceDetailPath(assetId, serviceId, serviceType) {
    const vehicle = normalizeMongoId(assetId);
    const service = normalizeMongoId(serviceId);
    if (!vehicle || !service) return null;
    const type = String(serviceType || '').trim();
    const base = `/HRM/Asset/Vehicle/details/${vehicle}`;
    if (type === 'Oil Service') return `${base}/oil-service/${service}`;
    if (type === 'Tire Change') return `${base}/tire-change/${service}`;
    if (type === 'Mechanical Work') return `${base}/mechanical-work/${service}`;
    if (type === 'Body Work') return `${base}/body-work/${service}`;
    if (type === 'Accident Repair') return `${base}/accident-repair/${service}`;
    return null;
}

/** Href for a vehicle service list row (fleet inbox / service-requests / detail tables). */
export function buildVehicleServiceListRowHref(row) {
    const vehicleId = normalizeMongoId(row?.vehicleId);
    const serviceId = normalizeMongoId(row?.serviceId || row?.id);
    if (!vehicleId || !serviceId) return '';
    const serviceType = String(row?.serviceType || '').trim();
    if (serviceType === 'Oil Service') {
        return `/HRM/Asset/Vehicle/details/${vehicleId}/oil-service/${serviceId}`;
    }
    if (serviceType === 'Car Wash') {
        return `/HRM/Asset/Vehicle/details/${vehicleId}?tab=service&carWashServiceId=${serviceId}`;
    }
    const typed = vehicleServiceDetailPath(vehicleId, serviceId, serviceType);
    if (typed) return typed;
    return `/HRM/Asset/Vehicle/service-requests/details/${vehicleId}/${serviceId}`;
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
                serviceReqNo: String(s.serviceReqNo || '').trim() || '—',
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

export function serviceCountByType(services, asset = null) {
    const counts = Object.fromEntries(VEHICLE_SERVICE_TYPES.map((t) => [t, 0]));
    for (const s of services || []) {
        const key = vehicleServiceTypeKey(s);
        if (!key || counts[key] == null) continue;
        if (isVehicleServiceCompletedForTabCount(s, asset)) continue;
        counts[key] += 1;
    }
    return counts;
}

/** True when the service row is finished — excluded from subtab incomplete counts. */
function isVehicleServiceCompletedForTabCount(service, asset) {
    const key = vehicleServiceTypeKey(service);
    if (key === 'Car Wash') {
        const remark = parseVehicleServiceRemark(service) || {};
        return String(remark.carWashPaymentStatus || '').toLowerCase() === 'paid';
    }
    const { label } = resolveOilServiceTableStatusLabel(service, asset);
    return String(label || '').trim().toLowerCase() === 'complete';
}

/** Latest services for a type, newest first (vehicle detail Service tab helpers). */
export function fleetServicesForTypeSortedDesc(services, type) {
    const list = (services || []).filter((s) => vehicleServiceTypeKey(s) === type);
    return [...list].sort((a, b) => {
        const ta = new Date(a?.date || a?.createdAt || 0).getTime();
        const tb = new Date(b?.date || b?.createdAt || 0).getTime();
        return tb - ta;
    });
}

/** Odometer on the vehicle asset (same source as Basic Details → Current KM). */
export function resolveAssetCurrentKilometer(asset) {
    const raw =
        asset?.currentKilometer ??
        asset?.currentKM ??
        asset?.currentKm ??
        asset?.km;
    if (raw == null || String(raw).trim() === '') return '';
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : String(raw).trim();
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

function completedOilServicesForAsset(asset) {
    const services = Array.isArray(asset?.services) ? asset.services : [];
    return services
        .filter((s) => vehicleServiceTypeKey(s) === 'Oil Service')
        .filter((s) => {
            const remark = parseVehicleServiceRemark(s);
            if (String(remark?.requestStatus || '').toLowerCase() === 'draft') return false;
            const row = {
                serviceId: normalizeMongoId(s._id),
                remark: s.remark,
                workflowSnapshot: s.workflowSnapshot,
            };
            const tone = resolveVehicleServiceListRowTone(row, {
                activeServiceWorkflow: asset?.activeServiceWorkflow,
            });
            return tone === 'done';
        })
        .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
}

function oilServiceRequestTableStatus(service, asset) {
    return resolveOilServiceTableStatusLabel(service, asset);
}

function isOilServiceRequestTableRow(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'pending' || requestStatus === 'submitted') return true;

    const serviceId = normalizeMongoId(service._id);
    if (service?.workflowSnapshot?.stage) return true;

    const activeWf = asset?.activeServiceWorkflow;
    if (activeWf && serviceId && normalizeMongoId(activeWf.serviceRecordId) === serviceId) {
        return true;
    }

    if (String(remark?.vehicleServiceCompleted || '').toLowerCase() === 'live') return true;

    return false;
}

/** `nextChangeMonth` from `<input type="month" />` e.g. "2026-04" */
/** Build an oil-service request row for the Service tab table. */
export function buildOilServiceScheduleRowFromAsset(asset, { id, service } = {}) {
    const completedOil = completedOilServicesForAsset(asset);
    const latestCompleted = completedOil[0] || null;
    const completedMeta = latestCompleted ? parseVehicleServiceRemark(latestCompleted) : null;
    const requestMeta = service ? parseVehicleServiceRemark(service) : null;
    const vehicleNo =
        [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim() ||
        asset?.plateNumber ||
        '—';

    const lastOilServiceKm =
        requestMeta?.lastChangeKm ??
        requestMeta?.currentKm ??
        completedMeta?.currentKm ??
        latestCompleted?.currentKm ??
        asset?.currentKilometer ??
        '—';

    const serviceId = service ? normalizeMongoId(service._id) : normalizeMongoId(id);
    const statusInfo = service
        ? oilServiceRequestTableStatus(service, asset)
        : { label: 'Draft', tone: 'draft' };
    const rowComplete = String(statusInfo?.tone || '').toLowerCase() === 'complete';

    // Next oil KM/date are set on Complete Service. While the request is open,
    // do not show nextChangeMonth (that field is the garage visit end month) or
    // fall back to vehicle.nextServiceDate (previous due date).
    let nextOilServiceKm = '—';
    let nextOilServiceDate = null;
    if (rowComplete) {
        nextOilServiceKm =
            requestMeta?.nextChangeKm != null && String(requestMeta.nextChangeKm).trim() !== ''
                ? requestMeta.nextChangeKm
                : '—';
        nextOilServiceDate = requestMeta?.nextServiceDate || null;
    } else if (requestMeta?.nextServiceDate) {
        nextOilServiceDate = requestMeta.nextServiceDate;
        nextOilServiceKm =
            requestMeta?.nextChangeKm != null && String(requestMeta.nextChangeKm).trim() !== ''
                ? requestMeta.nextChangeKm
                : '—';
    }

    const amountInfo = resolveServiceAmountTypeAndStatus(requestMeta || service);

    return {
        id: serviceId || id || `oil-pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        serviceId: serviceId || undefined,
        serviceReqNo: String(service?.serviceReqNo || '').trim() || '—',
        vehicleAssetNo: asset?.assetId || '—',
        vehicleNo,
        lastOilServiceKm,
        lastOilServiceDate:
            service?.date || service?.createdAt || asset?.oilChangeDate || latestCompleted?.date || null,
        nextOilServiceKm,
        nextOilServiceDate,
        amountType: amountInfo.amountType,
        amountStatus: amountInfo.amountStatus,
        amountStatusTone: amountInfo.amountStatusTone,
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        sortEndDate: service ? resolveVehicleServiceListEndDate(service, asset) : nextOilServiceDate || null,
        sortDate: service?.updatedAt || service?.createdAt || service?.date || null,
        createdAt: service?.createdAt || service?.date || null,
    };
}

/** Oil-service request rows (draft, pending, complete) for the Service tab table. */
export function buildOilServiceRequestRowsFromAsset(asset) {
    if (!asset) return [];
    const services = Array.isArray(asset.services) ? asset.services : [];
    return assignAndSortByVehicleServiceSl(
        services
            .filter((s) => vehicleServiceTypeKey(s) === 'Oil Service')
            .filter((s) => isOilServiceRequestTableRow(s, asset))
            .map((s) => buildOilServiceScheduleRowFromAsset(asset, { service: s })),
    );
}

export function findOpenOilServiceDraft(asset) {
    const services = Array.isArray(asset?.services) ? asset.services : [];
    return (
        services.find((s) => {
            if (vehicleServiceTypeKey(s) !== 'Oil Service') return false;
            const remark = parseVehicleServiceRemark(s);
            const status = String(remark?.requestStatus || '').toLowerCase();
            return status === 'draft' || status === 'pending';
        }) || null
    );
}

/** Minimal POST body for a new pending oil-service row from the vehicle Service tab. */
export function buildOilServicePendingRequestBody(asset) {
    const completedOil = completedOilServicesForAsset(asset);
    const latestCompleted = completedOil[0] || null;
    const completedMeta = latestCompleted ? parseVehicleServiceRemark(latestCompleted) : null;
    const currentKm = Number(
        completedMeta?.currentKm ?? latestCompleted?.currentKm ?? asset?.currentKilometer ?? 0,
    );

    return {
        serviceType: 'Oil Service',
        date: new Date().toISOString().slice(0, 10),
        currentKm,
        description: '',
        paidBy: 'Company',
        value: 0,
        remark: JSON.stringify({
            serviceSubtype: 'Oil Service',
            amountMode: 'amount',
            requestStatus: 'pending',
            currentKm,
            // Next oil KM/date are entered when Completing Service — do not copy the
            // previous due month/km onto a brand-new open request.
            nextChangeKm: '',
            serviceEndDate: '',
            nextChangeMonth: '',
            oilServiceTypeText: '',
        }),
        serviceRequestSource: 'vehicle_asset_detail',
        isDraft: true,
    };
}

/** @deprecated use buildOilServicePendingRequestBody */
export function buildOilServiceDraftRequestBody(asset) {
    return buildOilServicePendingRequestBody(asset);
}

function isCarWashRequestTableRow(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    const paymentStatus = String(remark.carWashPaymentStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'submitted') return true;
    if (paymentStatus === 'pending' || paymentStatus === 'not_paid') return true;
    if (service?.workflowSnapshot?.stage) return true;
    const serviceId = normalizeMongoId(service._id);
    const activeWf = asset?.activeServiceWorkflow;
    if (
        activeWf &&
        serviceId &&
        normalizeMongoId(activeWf.serviceRecordId) === serviceId &&
        String(activeWf.serviceTypeLabel || '') === 'Car Wash'
    ) {
        return true;
    }
    return false;
}

export function buildCarWashRequestRowFromAsset(asset, { service } = {}) {
    const vehicleNo =
        [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim() ||
        asset?.plateNumber ||
        '—';
    const remark = service ? parseVehicleServiceRemark(service) : null;
    const serviceId = service ? normalizeMongoId(service._id) : '';
    const statusInfo = service
        ? (() => {
              // Lazy import avoided — mirror vehicleCarWashAccess labels inline for this util.
              const requestStatus = String(remark?.requestStatus || '').toLowerCase();
              if (requestStatus === 'draft') return { label: 'Draft', tone: 'draft' };
              const paymentStatus = String(remark?.carWashPaymentStatus || '').toLowerCase();
              const billingStatus = String(remark?.billingStatus || '').toLowerCase();
              const stage = String(
                  service?.workflowSnapshot?.stage ||
                      (normalizeMongoId(asset?.activeServiceWorkflow?.serviceRecordId) === serviceId
                          ? asset?.activeServiceWorkflow?.stage
                          : '') ||
                      remark?.workflowStage ||
                      '',
              ).toLowerCase();
              if (stage === 'rejected') return { label: 'Rejected', tone: 'rejected' };
              if (stage === 'billed' || billingStatus === 'billed' || paymentStatus === 'billed') {
                  return { label: 'Complete', tone: 'complete' };
              }
              if (stage === 'pending_billing' || stage === 'pending_accounts') {
                  return { label: 'Completed', tone: 'complete' };
              }
              if (paymentStatus === 'not_paid' || stage === 'complete') {
                  return { label: 'Not paid', tone: 'complete' };
              }
              return { label: 'Pending', tone: 'pending' };
          })()
        : { label: 'Pending', tone: 'pending' };
    const amountInfo = resolveServiceAmountTypeAndStatus(remark || service);

    return {
        id: serviceId || `car-wash-${Date.now()}`,
        serviceId: serviceId || undefined,
        serviceReqNo: String(service?.serviceReqNo || '').trim() || '—',
        vehicleAssetNo: asset?.assetId || '—',
        vehicleNo,
        carWashMonth: remark?.carWashMonth || '',
        carWashType: remark?.carWashType || '—',
        amount: service?.value != null ? Number(service.value) : null,
        amountType: amountInfo.amountType,
        amountStatus: amountInfo.amountStatus,
        amountStatusTone: amountInfo.amountStatusTone,
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        sortEndDate: service ? resolveVehicleServiceListEndDate(service, asset) : null,
        sortDate: service?.updatedAt || service?.createdAt || service?.date || null,
        createdAt: service?.createdAt || service?.date || null,
        serviceRecord: service || null,
    };
}

export function buildCarWashRequestRowsFromAsset(asset) {
    if (!asset) return [];
    const services = Array.isArray(asset.services) ? asset.services : [];
    return assignAndSortByVehicleServiceSl(
        services
            .filter((s) => vehicleServiceTypeKey(s) === 'Car Wash')
            .filter((s) => isCarWashRequestTableRow(s, asset))
            .map((s) => buildCarWashRequestRowFromAsset(asset, { service: s })),
    );
}

function isVehicleServiceTabRequestTableRow(service, asset) {
    const remark = parseVehicleServiceRemark(service) || {};
    const requestStatus = String(remark.requestStatus || '').toLowerCase();
    if (requestStatus === 'draft' || requestStatus === 'pending' || requestStatus === 'submitted') return true;

    const serviceId = normalizeMongoId(service._id);
    if (service?.workflowSnapshot?.stage) return true;

    const activeWf = asset?.activeServiceWorkflow;
    if (activeWf && serviceId && normalizeMongoId(activeWf.serviceRecordId) === serviceId) {
        return true;
    }

    if (String(remark?.vehicleServiceCompleted || '').toLowerCase() === 'live') return true;

    return false;
}

export function buildVehicleServiceTabRequestRowFromAsset(asset, serviceType, { service } = {}) {
    const remark = service ? parseVehicleServiceRemark(service) : null;
    const vehicleNo =
        [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim() ||
        asset?.plateNumber ||
        '—';
    const serviceId = service ? normalizeMongoId(service._id) : '';
    const statusInfo = service
        ? resolveOilServiceTableStatusLabel(service, asset)
        : { label: 'Draft', tone: 'draft' };
    const amountInfo = resolveServiceAmountTypeAndStatus(remark || service);

    return {
        id: serviceId || `${serviceType}-pending-${Date.now()}`,
        serviceId: serviceId || undefined,
        serviceReqNo: String(service?.serviceReqNo || '').trim() || '—',
        vehicleAssetNo: asset?.assetId || '—',
        vehicleNo,
        requestDate: service?.date || service?.createdAt || null,
        currentKm: remark?.currentKm ?? service?.currentKm ?? asset?.currentKilometer ?? '—',
        amountType: amountInfo.amountType,
        amountStatus: amountInfo.amountStatus,
        amountStatusTone: amountInfo.amountStatusTone,
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        sortEndDate: service ? resolveVehicleServiceListEndDate(service, asset) : null,
        sortDate: service?.updatedAt || service?.createdAt || service?.date || null,
        createdAt: service?.createdAt || service?.date || null,
        serviceRecord: service || null,
    };
}

export function buildVehicleServiceTabRequestRowsFromAsset(asset, serviceType) {
    if (!asset || !isVehicleServiceTabRequestType(serviceType)) return [];
    const services = Array.isArray(asset.services) ? asset.services : [];
    return assignAndSortByVehicleServiceSl(
        services
            .filter((s) => vehicleServiceTypeKey(s) === serviceType)
            .filter((s) => isVehicleServiceTabRequestTableRow(s, asset))
            .map((s) => buildVehicleServiceTabRequestRowFromAsset(asset, serviceType, { service: s })),
    );
}

export function findOpenVehicleServiceTabDraft(asset, serviceType) {
    if (!isVehicleServiceTabRequestType(serviceType)) return null;
    const services = Array.isArray(asset?.services) ? asset.services : [];
    return (
        services.find((s) => {
            if (vehicleServiceTypeKey(s) !== serviceType) return false;
            const remark = parseVehicleServiceRemark(s);
            const status = String(remark?.requestStatus || '').toLowerCase();
            return status === 'draft' || status === 'pending';
        }) || null
    );
}

export function buildVehicleServiceTabPendingRequestBody(asset, serviceType) {
    const currentKm = Number(asset?.currentKilometer ?? 0);
    return {
        serviceType,
        date: new Date().toISOString().slice(0, 10),
        currentKm,
        description: '',
        paidBy: 'Company',
        value: 0,
        remark: JSON.stringify({
            serviceSubtype: serviceType,
            amountMode: 'amount',
            requestStatus: 'pending',
            currentKm,
        }),
        serviceRequestSource: 'vehicle_asset_detail',
        isDraft: true,
    };
}

/**
 * Pending service create from Vehicle list / fleet dashboard (type + vehicle only).
 * Uses the same row/email bootstrap as the vehicle Service tab.
 */
export function buildFleetListServicePendingRequestBody(asset, serviceType, { source = 'vehicle_fleet_dashboard' } = {}) {
    const type = String(serviceType || '').trim();
    if (type === 'Oil Service') {
        return {
            ...buildOilServicePendingRequestBody(asset),
            serviceRequestSource: source,
        };
    }
    if (type === 'Car Wash') {
        const currentKm = Number(asset?.currentKilometer ?? 0);
        const now = new Date();
        const carWashMonth = resolveNextCarWashMonth(asset) ||
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return {
            serviceType: 'Car Wash',
            date: now.toISOString().slice(0, 10),
            currentKm,
            description: `Car wash request — ${formatNextChangeMonthDisplay(carWashMonth)}`,
            paidBy: 'Company',
            value: 0,
            remark: JSON.stringify({
                serviceSubtype: 'Car Wash',
                amountMode: 'amount',
                requestStatus: 'pending',
                currentKm,
                carWashMonth,
                carWashType: 'Exterior',
                carWashPaymentStatus: 'pending',
            }),
            serviceRequestSource: source,
            isDraft: true,
        };
    }
    if (isVehicleServiceTabRequestType(type)) {
        return {
            ...buildVehicleServiceTabPendingRequestBody(asset, type),
            serviceRequestSource: source,
        };
    }
    return {
        serviceType: type || 'Other',
        date: new Date().toISOString().slice(0, 10),
        currentKm: Number(asset?.currentKilometer ?? 0),
        description: '',
        paidBy: 'Company',
        value: 0,
        remark: JSON.stringify({
            serviceSubtype: type || 'Other',
            amountMode: 'amount',
            requestStatus: 'pending',
        }),
        serviceRequestSource: source,
        isDraft: true,
    };
}

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

/** Normalize car-wash month values to `yyyy-MM`. */
export function normalizeCarWashMonthKey(ym) {
    const m = String(ym || '').trim().match(/^(\d{4})-(\d{1,2})/);
    if (!m) return '';
    const month = parseInt(m[2], 10);
    if (!month || month < 1 || month > 12) return '';
    return `${m[1]}-${String(month).padStart(2, '0')}`;
}

export function addMonthsToCarWashMonth(ym, delta = 1) {
    const key = normalizeCarWashMonthKey(ym);
    if (!key) return '';
    const [year, month] = key.split('-').map(Number);
    const next = new Date(year, month - 1 + Number(delta || 0), 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function isRejectedCarWashService(service, asset) {
    const serviceId = normalizeMongoId(service?._id);
    const stage = String(
        service?.workflowSnapshot?.stage ||
            (serviceId &&
            normalizeMongoId(asset?.activeServiceWorkflow?.serviceRecordId) === serviceId
                ? asset?.activeServiceWorkflow?.stage
                : '') ||
            '',
    ).toLowerCase();
    return stage === 'rejected';
}

/** Occupied wash months for a vehicle (rejected requests do not block the month). */
export function listOccupiedCarWashMonths(asset, { excludeServiceId = null } = {}) {
    const excludeId = normalizeMongoId(excludeServiceId);
    const occupied = new Set();
    const services = Array.isArray(asset?.services) ? asset.services : [];
    for (const service of services) {
        if (vehicleServiceTypeKey(service) !== 'Car Wash') continue;
        if (excludeId && normalizeMongoId(service?._id) === excludeId) continue;
        if (isRejectedCarWashService(service, asset)) continue;
        const remark = parseVehicleServiceRemark(service) || {};
        const monthKey = normalizeCarWashMonthKey(remark.carWashMonth);
        if (monthKey) occupied.add(monthKey);
    }
    return occupied;
}

export function isCarWashMonthOccupied(asset, month, { excludeServiceId = null } = {}) {
    const monthKey = normalizeCarWashMonthKey(month);
    if (!monthKey) return false;
    return listOccupiedCarWashMonths(asset, { excludeServiceId }).has(monthKey);
}

/**
 * Next wash month = latest existing wash month + 1.
 * If none exist, use the current calendar month (or the next free month if current is somehow taken).
 */
export function resolveNextCarWashMonth(asset, { excludeServiceId = null } = {}) {
    const occupied = listOccupiedCarWashMonths(asset, { excludeServiceId });
    const sorted = [...occupied].sort();
    const latest = sorted[sorted.length - 1];
    let candidate = latest
        ? addMonthsToCarWashMonth(latest, 1)
        : normalizeCarWashMonthKey(
              `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          );
    while (candidate && occupied.has(candidate)) {
        candidate = addMonthsToCarWashMonth(candidate, 1);
    }
    return (
        candidate ||
        normalizeCarWashMonthKey(
            `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        )
    );
}
