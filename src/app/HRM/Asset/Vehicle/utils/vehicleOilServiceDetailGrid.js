import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import { formatNextChangeMonthDisplay, parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { pickLatestDocOfType } from './vehicleExpirySources';

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

function formatKm(value) {
    if (value == null || value === '' || value === '—') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString()} KM`;
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatWarrantyExpiry(asset) {
    const docs = Array.isArray(asset?.documents) ? asset.documents : [];
    const warrantyDoc = pickLatestDocOfType(docs, 'warranty');
    const raw = warrantyDoc?.expiryDate || asset?.warrantyExpiryDate || asset?.warrantyEndDate || null;
    if (!raw) return '—';
    return formatDate(raw);
}

export function formatWarrantyExpiryFromAsset(asset) {
    return formatWarrantyExpiry(asset);
}

function employeeName(emp) {
    if (!emp || typeof emp !== 'object') return '—';
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name || emp.employeeId || '—';
}

function findEmployeeLabel(employees, id) {
    if (!id) return '—';
    const list = Array.isArray(employees) ? employees : [];
    const match = list.find((e) => String(e._id) === String(id));
    if (match) return employeeName(match);
    return String(id);
}

function fileLabel(service, urlKey, nameKey, remark) {
    if (remark?.[nameKey]) return remark[nameKey];
    if (service?.[urlKey]) return 'On file';
    return '—';
}

export function buildOilServiceDetailGridFields(asset, service, scheduleRow, employees = []) {
    if (!asset || !service) return { fields: [], workDescription: '—' };

    const remark = parseVehicleServiceRemark(service) || {};
    const paymentType =
        remark.amountMode === 'warranty' ? 'Warranty' : remark.amountMode === 'amount' ? 'Cash' : '—';

    const fields = [
        { label: 'Payment Type', value: paymentType },
        { label: 'Select Warranty Type', value: remark.vendorName || '—' },
        { label: 'Warranty Expiry', value: formatWarrantyExpiry(asset) },
        { label: 'Oil Type', value: remark.oilServiceTypeText || '—' },
        { label: 'OIL Milage', value: formatKm(remark.nextChangeKm ?? scheduleRow?.nextOilServiceKm) },
        {
            label: 'Last change KM',
            value: formatKm(scheduleRow?.lastOilServiceKm ?? remark.currentKm ?? service.currentKm),
        },
        {
            label: 'Vehicle assigned',
            value:
                remark.vehicleOwnerEmployeeId
                    ? findEmployeeLabel(employees, remark.vehicleOwnerEmployeeId)
                    : employeeName(asset?.assignedTo),
        },
        {
            label: 'Car Driven By',
            value: findEmployeeLabel(employees, remark.carDrivenByEmployeeId),
        },
        { label: 'Amount', value: formatMoney(service.value) },
        {
            label: 'Quote 1',
            value: fileLabel(service, 'attachment', 'attachmentName', remark),
        },
        {
            label: 'Quote 2',
            value: fileLabel(service, 'quotation2', 'quotation2Name', remark),
        },
        {
            label: 'Quote 3',
            value: fileLabel(service, 'quotation3', 'quotation3Name', remark),
        },
        { label: 'Garage Name', value: remark.garageName || remark.vendorName || '—' },
        { label: 'Garage Location', value: remark.garageLocation || '—' },
        { label: 'Garage Contact', value: remark.garageContact || '—' },
        {
            label: 'Service Req No',
            value: String(service._id || '').slice(-8) || asset?.assetId || '—',
        },
        {
            label: 'Service Start Date',
            value: formatDate(remark.serviceStartDate || service.date || service.createdAt),
        },
        {
            label: 'Next Service Month',
            value: remark.nextChangeMonth
                ? formatNextChangeMonthDisplay(remark.nextChangeMonth)
                : formatDate(scheduleRow?.nextOilServiceDate),
        },
    ];

    return {
        fields,
        workDescription: service.description || remark.serviceIssue || '—',
    };
}

export const OIL_SERVICE_DETAIL_GRID_LAYOUT = {
    columns: 3,
    fieldMinHeightPx: 56,
    gapClass: 'gap-2.5',
};

export const OIL_SERVICE_DETAIL_GRID_ACCENTS = [
    'border-gray-100 bg-white',
    'border-gray-100 bg-white',
    'border-gray-100 bg-white',
];
