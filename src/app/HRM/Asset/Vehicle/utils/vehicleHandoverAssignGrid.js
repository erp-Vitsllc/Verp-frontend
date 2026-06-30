import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import { pickLatestDocOfType } from './vehicleExpirySources';
import { getHandoverByLabel, getHandoverToLabel, isVehicleInspectionHandoverEntry } from './vehicleHandoverHistory';
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

function resolveDrivingLicenseAge(assignee) {
    if (!assignee || typeof assignee !== 'object') return '—';
    const lic = assignee.drivingLicenceDetails || assignee.drivingLicenseDetails;
    const issueDate = lic?.issueDate;
    if (!issueDate) return '—';
    const parts = decomposeCalendarDurationBetween(issueDate, new Date());
    return parts ? formatDurationParts(parts) : '—';
}

function resolveCurrentUsage(asset) {
    const km = asset?.currentKilometer ?? asset?.currentKM ?? asset?.currentKm;
    if (km === null || km === undefined || String(km).trim() === '') return '—';
    const n = Number(km);
    return Number.isFinite(n) ? `${n.toLocaleString()} KM` : `${String(km).trim()} KM`;
}

export function buildVehicleHandoverAssignGridFields(historyEntry, vehicle) {
    if (!historyEntry) return [];

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
        { label: 'Handover By', value: getHandoverByLabel(historyEntry) },
        { label: 'Hand Over to', value: getHandoverToLabel(historyEntry) },
        { label: 'Warranty', value: resolveWarrantyLabel(warrantyDoc, asset) },
        { label: 'Current Usage', value: resolveCurrentUsage(asset) },
        {
            label: 'Hand Over Date',
            value: formatDate(historyEntry?.date || historyEntry?.createdAt),
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
