import { parseVehicleServiceRemark } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

export function buildGarageHistoryOptions(asset, service, currentName) {
    const set = new Set();
    const add = (value) => {
        const trimmed = String(value || '').trim();
        if (trimmed) set.add(trimmed);
    };

    add(currentName);
    const remark = parseVehicleServiceRemark(service) || {};
    add(remark.garageName);
    add(remark.vendorName);

    if (Array.isArray(asset?.services)) {
        asset.services.forEach((row) => {
            const rowRemark = parseVehicleServiceRemark(row) || {};
            add(rowRemark.garageName);
            add(rowRemark.vendorName);
        });
    }

    return Array.from(set);
}
