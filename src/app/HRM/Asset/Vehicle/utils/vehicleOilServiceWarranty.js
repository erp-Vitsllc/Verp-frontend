import { formatWarrantyExpiryFromAsset } from './vehicleOilServiceDetailGrid';

function parseWarrantyEnabled(value) {
    if (typeof value === 'boolean') return value;
    const raw = String(value || '').toLowerCase().trim();
    if (['yes', 'true', '1', 'enabled', 'active'].includes(raw)) return true;
    if (['no', 'false', '0', 'disabled', 'inactive'].includes(raw)) return false;
    return null;
}

function warrantyExpiryDate(asset) {
    const docs = Array.isArray(asset?.documents) ? asset.documents : [];
    const warrantyDoc = docs.find((d) => String(d?.type || d?.documentType || '').toLowerCase() === 'warranty');
    return (
        warrantyDoc?.expiryDate ||
        asset?.warrantyExpiryDate ||
        asset?.warrantyEndDate ||
        null
    );
}

/** True when the vehicle has an active warranty (shows warranty payment fields). */
export function vehicleHasActiveWarranty(asset) {
    if (!asset) return false;
    const flag =
        parseWarrantyEnabled(asset.warrantyEnabled) ??
        parseWarrantyEnabled(asset.warranty) ??
        parseWarrantyEnabled(asset.hasWarranty);
    const expiry = warrantyExpiryDate(asset);
    if (flag === false) return false;
    if (flag === true) {
        if (!expiry) return true;
        const end = new Date(expiry);
        return !Number.isNaN(end.getTime()) && end >= new Date(new Date().toDateString());
    }
    if (expiry) {
        const end = new Date(expiry);
        return !Number.isNaN(end.getTime()) && end >= new Date(new Date().toDateString());
    }
    return false;
}

export function resolveDefaultPaymentMode(asset) {
    return vehicleHasActiveWarranty(asset) ? 'warranty' : 'amount';
}

export { formatWarrantyExpiryFromAsset };
