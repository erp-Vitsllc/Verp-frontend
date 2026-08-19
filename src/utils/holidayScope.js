/** Legacy holidays with no appliesTo count as both Office and Staff (site). */
export function holidayAppliesToList(holiday) {
    const raw = holiday?.appliesTo;
    if (!Array.isArray(raw) || raw.length === 0) return ['office', 'site'];
    const set = new Set(
        raw.map((v) => (String(v).trim().toLowerCase() === 'site' ? 'site' : 'office')),
    );
    return ['office', 'site'].filter((key) => set.has(key));
}

export function holidayAppliesToStaff(holiday, staffType) {
    if (!holiday) return false;
    const wanted = String(staffType || '').toLowerCase() === 'site' ? 'site' : 'office';
    return holidayAppliesToList(holiday).includes(wanted);
}
