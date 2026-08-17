import { VEHICLE_SERVICE_TYPES } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

export const VEHICLE_ACCESS_SERVICE_TYPES = VEHICLE_SERVICE_TYPES;

export function vehicleAccessServiceSlug(type) {
    return String(type || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
}

export function vehicleAccessServiceTypeFromSlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return VEHICLE_ACCESS_SERVICE_TYPES.find((type) => vehicleAccessServiceSlug(type) === key) || '';
}

export function vehicleAccessServiceListPath(type) {
    const slug = vehicleAccessServiceSlug(type);
    return slug ? `/HRM/Asset/Vehicle/access-service/${encodeURIComponent(slug)}` : '/HRM/Asset/Vehicle/access-service';
}
