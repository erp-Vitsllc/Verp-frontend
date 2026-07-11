/**
 * Display Service Req No: `{assetId}-{NNN}` (e.g. VEGA-Veh-001-001).
 * Prefers stored serviceReqNo; falls back to index among asset.services for legacy rows.
 */
export function formatVehicleServiceReqNo(service, asset) {
    const stored = String(service?.serviceReqNo || '').trim();
    if (stored) return stored;

    const assetId = String(asset?.assetId || '').trim();
    const services = Array.isArray(asset?.services) ? asset.services : [];
    if (assetId && service?._id && services.length) {
        const idx = services.findIndex((s) => String(s?._id) === String(service._id));
        if (idx >= 0) {
            return `${assetId}-${String(idx + 1).padStart(3, '0')}`;
        }
    }

    const fallback = String(service?._id || '').slice(-8);
    return fallback || assetId || '—';
}
