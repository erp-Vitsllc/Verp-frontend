import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import { pickLatestDocOfType } from './vehicleExpirySources';
import { getHandoverByLabel, getHandoverReason, getHandoverToLabel } from './vehicleHandoverHistory';
import { resolvePreviousHandoverEntry } from './vehicleHandoverPreviousReports';
import {
    decomposeCalendarDurationBetween,
    formatDurationParts,
} from '@/app/emp/[employeeId]/utils/helpers';

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatPlate(asset) {
    const plate = `${asset?.plateEmirate || ''} ${asset?.plateNumber || ''}`.trim();
    return plate || '—';
}

function parseDocJson(doc) {
    if (!doc?.description) return null;
    try {
        return JSON.parse(doc.description);
    } catch {
        return null;
    }
}

function resolveInsuranceBy(insuranceDoc, asset) {
    const parsed = parseDocJson(insuranceDoc);
    return (
        parsed?.company ||
        parsed?.policy ||
        insuranceDoc?.issueAuthority ||
        asset?.insuranceCompany ||
        asset?.insuranceProvider ||
        '—'
    );
}

function resolveWarrantyLabel(warrantyDoc, asset) {
    const expiry =
        warrantyDoc?.expiryDate ||
        asset?.warrantyExpiryDate ||
        asset?.warrantyEndDate ||
        asset?.warrantyDate ||
        null;

    if (expiry) return formatDate(expiry);

    const parsed = parseDocJson(warrantyDoc);
    const by = parsed?.warrantyBy || asset?.warrantyBy || asset?.warrantyProvider || '';
    const km = parsed?.endKm ?? parsed?.currentKm ?? parsed?.km ?? asset?.warrantyKm ?? null;

    if (by && km != null && String(km).trim() !== '') {
        return `${by} · ${Number(km).toLocaleString()} KM`;
    }
    if (by) return by;
    if (km != null && String(km).trim() !== '') return `${Number(km).toLocaleString()} KM`;

    if (asset?.warrantyEnabled === false) return 'No';
    return '—';
}

/**
 * Driving License Age = Hand Over To (driver) profile license start/issue date → today.
 * Shown as years / months / days; any unit that is 0 is omitted.
 */
function resolveDrivingLicenseAge(assignee) {
    if (!assignee || typeof assignee !== 'object') return '—';
    const lic = assignee.drivingLicenceDetails || assignee.drivingLicenseDetails || {};
    const issueDate =
        lic.issueDate ||
        lic.startDate ||
        assignee.drivingLicenseIssueDate ||
        assignee.drivingLicenceIssueDate ||
        null;
    if (!issueDate) return '—';
    const parts = decomposeCalendarDurationBetween(issueDate, new Date());
    if (!parts) return '—';
    // formatDurationParts already skips years/months/days when count is 0
    return formatDurationParts(parts) || '—';
}

function resolveCurrentKm(vehicle, historyEntry = null) {
    // Prefer live Locator odometer, then vehicle.currentKilometer.
    // Do NOT read history.details.currentKm — that is often warranty/service metadata.
    const handoverStored =
        historyEntry?.details?.handoverCurrentKilometer ??
        historyEntry?.details?.odometerAtHandover ??
        null;
    const candidates = [
        vehicle?.locator?.currentKilometer,
        vehicle?.locator?.odometerKm,
        vehicle?.currentKilometer,
        handoverStored,
    ];
    for (const km of candidates) {
        if (km === null || km === undefined || String(km).trim() === '') continue;
        const n = Number(km);
        if (Number.isFinite(n)) return `${n.toLocaleString()} KM`;
        return `${String(km).trim()} KM`;
    }
    return '—';
}

function resolveCurrentHandoverDate(historyEntry, vehicle) {
    return (
        historyEntry?.date ||
        historyEntry?.createdAt ||
        historyEntry?.details?.handoverDate ||
        vehicle?.assignedDate ||
        null
    );
}

/** Current handover date → today (same duration helpers used elsewhere). */
function resolvePreviousVehicleUsedDays(historyEntry, vehicle) {
    const handoverDate = resolveCurrentHandoverDate(historyEntry, vehicle);
    if (!handoverDate) return '—';
    const parts = decomposeCalendarDurationBetween(handoverDate, new Date());
    if (!parts) return '—';
    return formatDurationParts(parts) || '—';
}

function resolvePreviousHandoverDateLabel(historyEntry, assetHistory = []) {
    const previous = resolvePreviousHandoverEntry(assetHistory, historyEntry);
    if (!previous) return '—';
    return formatDate(previous?.date || previous?.createdAt || previous?.details?.handoverDate);
}

export function buildVehicleHandoverAssignGridFields(historyEntry, vehicle, options = {}) {
    if (!historyEntry) return [];

    const assetHistory = Array.isArray(options.assetHistory) ? options.assetHistory : [];
    const snapshot =
        historyEntry?.details && typeof historyEntry.details === 'object'
            ? historyEntry.details
            : vehicle || {};
    const asset = { ...(vehicle || {}), ...(snapshot || {}) };
    const docs = Array.isArray(asset.documents) ? asset.documents : [];

    const registrationDoc = pickLatestDocOfType(docs, 'registration');
    const insuranceDoc = pickLatestDocOfType(docs, 'insurance');
    const warrantyDoc = pickLatestDocOfType(docs, 'warranty');

    const assignee =
        historyEntry?.assignedTo ||
        snapshot?.assignedTo ||
        asset?.assignedTo;

    const assignmentReason = getHandoverReason(historyEntry, vehicle);

    return [
        { label: 'Vehicle NO', value: formatPlate(asset) },
        { label: 'Model', value: asset?.name || '—' },
        { label: 'Year', value: asset?.modelYear ? String(asset.modelYear) : '—' },
        { label: 'Asset No', value: asset?.assetId || '—' },
        { label: 'Brand', value: getVehicleBrandLabel(asset) || '—' },
        {
            label: 'Reg Expiry',
            value: formatDate(registrationDoc?.expiryDate || asset?.registrationExpiryDate),
        },
        { label: 'Handover By', value: getHandoverByLabel(historyEntry, vehicle) },
        { label: 'Hand Over to', value: getHandoverToLabel(historyEntry, vehicle) },
        ...(assignmentReason && assignmentReason !== '-'
            ? [{ label: 'Assignment Reason', value: assignmentReason }]
            : []),
        { label: 'Warranty', value: resolveWarrantyLabel(warrantyDoc, asset) },
        { label: 'Current KM', value: resolveCurrentKm(vehicle, historyEntry) },
        {
            label: 'Hand Over Date',
            value: formatDate(resolveCurrentHandoverDate(historyEntry, vehicle)),
        },
        {
            label: 'Previous Vehicle Used Days',
            value: resolvePreviousVehicleUsedDays(historyEntry, vehicle),
        },
        {
            label: 'Previous Handover Date',
            value: resolvePreviousHandoverDateLabel(historyEntry, assetHistory),
        },
        { label: 'Driving License Age', value: resolveDrivingLicenseAge(assignee) },
        { label: 'Vehicle Value', value: formatMoney(asset?.assetValue) },
        { label: 'Insurance by', value: resolveInsuranceBy(insuranceDoc, asset) },
        {
            label: 'Insurance Expiry',
            value: formatDate(insuranceDoc?.expiryDate || asset?.insuranceExpiryDate),
        },
    ];
}

export function splitHandoverFieldsIntoColumns(fields = []) {
    return [
        fields.filter((_, index) => index % 3 === 0),
        fields.filter((_, index) => index % 3 === 1),
        fields.filter((_, index) => index % 3 === 2),
    ];
}

export function splitHandoverFieldsIntoTwoColumns(fields = []) {
    return [
        fields.filter((_, index) => index % 2 === 0),
        fields.filter((_, index) => index % 2 === 1),
    ];
}

export const HANDOVER_ASSIGN_GRID_LAYOUT = {
    columns: 3,
    fieldMinHeightPx: 56,
    gapClass: 'gap-2.5',
};

export const HANDOVER_ASSIGN_GRID_ACCENTS = [
    'border-gray-100 bg-white',
    'border-gray-100 bg-white',
    'border-gray-100 bg-white',
];
