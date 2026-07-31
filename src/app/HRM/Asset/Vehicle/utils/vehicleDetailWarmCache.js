/**
 * Warm cache for vehicle detail light payloads — filled when hovering/opening
 * a vehicle notification so the destination page can paint without waiting.
 */
import axiosInstance from '@/utils/axios';

const memory = new Map();
const inflight = new Map();
const MAX_ENTRIES = 40;
const MAX_AGE_MS = 2 * 60 * 1000;

function touch(id, entry) {
    memory.delete(id);
    memory.set(id, entry);
    while (memory.size > MAX_ENTRIES) {
        const oldest = memory.keys().next().value;
        memory.delete(oldest);
    }
}

export function readWarmVehicleDetail(assetId) {
    const id = String(assetId || '').trim();
    if (!id) return null;
    const entry = memory.get(id);
    if (!entry) return null;
    if (Date.now() - entry.at > MAX_AGE_MS) {
        memory.delete(id);
        return null;
    }
    return entry.data || null;
}

export function writeWarmVehicleDetail(assetId, data) {
    const id = String(assetId || '').trim();
    if (!id || !data || typeof data !== 'object') return;
    touch(id, { at: Date.now(), data });
}

/** Prefetch GET /AssetItem/detail/:id?light=1 into memory. */
export function warmVehicleDetailLight(assetId) {
    const id = String(assetId || '').trim();
    if (!id || typeof window === 'undefined') return Promise.resolve(null);
    const cached = readWarmVehicleDetail(id);
    if (cached) return Promise.resolve(cached);
    if (inflight.has(id)) return inflight.get(id);

    const req = axiosInstance
        .get(`/AssetItem/detail/${id}`, {
            params: { light: 1 },
            timeout: 15000,
            skipToast: true,
        })
        .then((res) => {
            const data = res?.data;
            if (data && data._id) writeWarmVehicleDetail(id, data);
            return data && data._id ? data : null;
        })
        .catch(() => null)
        .finally(() => {
            inflight.delete(id);
        });

    inflight.set(id, req);
    return req;
}

/** Extract vehicle Mongo id from a vehicle notification href. */
export function vehicleIdFromNotificationHref(href = '') {
    const path = String(href || '');
    const m = path.match(/\/HRM\/Asset\/Vehicle\/details\/([a-f0-9]{24})/i);
    return m?.[1] || '';
}
