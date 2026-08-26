/** Legacy holidays with no appliesTo count as both Office and Site. */
export function holidayAppliesToList(holiday) {
    const raw = holiday?.appliesTo;
    if (!Array.isArray(raw) || raw.length === 0) return ['office', 'site'];
    return [...new Set(
        raw.map((v) => {
            const key = String(v).trim().toLowerCase();
            if (key === 'staff') return 'site';
            return key;
        }).filter(Boolean),
    )];
}

/** Office+Site with no custom keys = company-wide holiday from before extra locations. */
export function isLegacyCompanyWideAppliesTo(list) {
    const keys = Array.isArray(list) ? list : [];
    return (
        keys.includes('office') &&
        keys.includes('site') &&
        keys.every((key) => key === 'office' || key === 'site')
    );
}

export function holidayCoversLocation(holiday, locationKey) {
    const wanted = String(locationKey || '').trim().toLowerCase();
    if (!wanted) return false;
    const list = holidayAppliesToList(holiday);
    if (list.includes(wanted)) return true;
    return isLegacyCompanyWideAppliesTo(list);
}

export function holidayAppliesToStaff(holiday, staffType) {
    if (!holiday) return false;
    const wanted = String(staffType || '').trim().toLowerCase() || 'office';
    return holidayCoversLocation(holiday, wanted);
}
