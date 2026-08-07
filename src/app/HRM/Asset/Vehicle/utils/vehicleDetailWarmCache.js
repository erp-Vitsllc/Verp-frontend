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

/**
 * Prefetch GET /AssetItem/detail/:id?light=1 into memory.
 * Pass serviceId for shop deep-links so the light payload includes that request.
 */
export function warmVehicleDetailLight(assetId, { serviceId = '' } = {}) {
    const id = String(assetId || '').trim();
    if (!id || typeof window === 'undefined') return Promise.resolve(null);
    const sid = String(serviceId || '').trim();
    const inflightKey = sid ? `${id}:${sid}` : id;

    const cached = readWarmVehicleDetail(id);
    // Reuse cache when it already contains the focused service (or no service was requested).
    if (cached) {
        if (!sid) return Promise.resolve(cached);
        const services = Array.isArray(cached.services) ? cached.services : [];
        const hasService = services.some((row) => String(row?._id || '') === sid);
        if (hasService) return Promise.resolve(cached);
    }
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const params = { light: 1 };
    if (sid) params.serviceId = sid;

    const req = axiosInstance
        .get(`/AssetItem/detail/${id}`, {
            params,
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
            inflight.delete(inflightKey);
        });

    inflight.set(inflightKey, req);
    return req;
}

/** Extract vehicle Mongo id from a vehicle notification href. */
export function vehicleIdFromNotificationHref(href = '') {
    const path = String(href || '');
    const m = path.match(/\/HRM\/Asset\/Vehicle\/details\/([a-f0-9]{24})/i);
    return m?.[1] || '';
}

/** Extract shop service Mongo id from vehicle notification deep-links. */
export function serviceIdFromNotificationHref(href = '') {
    const path = String(href || '');
    const m = path.match(
        /\/HRM\/Asset\/Vehicle\/details\/[a-f0-9]{24}\/(?:accident-repair|body-work|mechanical-work|tire-change|oil-service)\/([a-f0-9]{24})/i,
    );
    return m?.[1] || '';
}
