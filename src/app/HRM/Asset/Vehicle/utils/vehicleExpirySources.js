import { normVehicleDocType } from './vehicleDocumentCardRows';
import {
    decomposeCalendarDurationUntil,
    formatDurationParts,
} from '@/app/emp/[employeeId]/utils/helpers';

export function pickLatestDocOfType(list, type) {
    const norm = normVehicleDocType(type);
    const matches = (list || []).filter((d) => normVehicleDocType(d.type) === norm);
    if (!matches.length) return null;
    return [...matches].sort((a, b) => {
        const ta = new Date(a.issueDate || a.expiryDate || a.createdAt || 0).getTime();
        const tb = new Date(b.issueDate || b.expiryDate || b.createdAt || 0).getTime();
        return tb - ta;
    })[0];
}

/** Current live registration document (excludes renewed/archived rows). */
export function resolveLiveRegistrationDoc(liveBuckets) {
    return (liveBuckets?.registration || []).find((d) => normVehicleDocType(d.type) === 'registration') || null;
}

/** Current live insurance document (excludes renewed/archived rows). */
export function resolveLiveInsuranceDoc(liveBuckets) {
    return (liveBuckets?.insurance || []).find((d) => normVehicleDocType(d.type) === 'insurance') || null;
}

/** Latest live warranty document. */
export function resolveLiveWarrantyDoc(liveBuckets) {
    return pickLatestDocOfType(liveBuckets?.warranty || [], 'warranty');
}

/** Earliest upcoming service / gear-oil due date (fleet dashboard rule). */
export function resolveNextMaintenanceDate(asset) {
    const dates = [asset?.nextServiceDate, asset?.gearOilDueDate].filter(Boolean);
    if (!dates.length) return null;

    let earliest = null;
    let earliestTime = Infinity;
    for (const d of dates) {
        const t = new Date(d).getTime();
        if (!Number.isNaN(t) && t < earliestTime) {
            earliestTime = t;
            earliest = d;
        }
    }
    return earliest;
}

export function resolveVehicleExpirySources(asset, liveBuckets) {
    const registrationDoc = resolveLiveRegistrationDoc(liveBuckets);
    const insuranceDoc = resolveLiveInsuranceDoc(liveBuckets);
    const warrantyDoc = resolveLiveWarrantyDoc(liveBuckets);

    return {
        registrationExpirySrc: registrationDoc?.expiryDate || asset?.registrationExpiryDate || null,
        insuranceExpirySrc: insuranceDoc?.expiryDate || asset?.insuranceExpiryDate || null,
        warrantyExpirySrc:
            warrantyDoc?.expiryDate ||
            asset?.warrantyExpiryDate ||
            asset?.warrantyEndDate ||
            asset?.warrantyDate ||
            null,
        serviceExpirySrc: resolveNextMaintenanceDate(asset),
    };
}

/** Blue card value: "Expires in …" / "Expired … ago" / "Not on file". */
export function formatVehicleExpiryCountdown(expiryDate) {
    if (expiryDate == null || String(expiryDate).trim() === '') return 'Not on file';
    const parts = decomposeCalendarDurationUntil(expiryDate);
    if (!parts) return 'Not on file';
    const duration = formatDurationParts(parts);
    if (parts.expired) return `Expired ${duration} ago`;
    return `Expires in ${duration}`;
}
