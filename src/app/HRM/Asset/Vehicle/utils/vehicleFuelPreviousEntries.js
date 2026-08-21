/** Latest entry stays on the main row. Older entries are previous fuels. */
export function previousFuelEntries(entries = []) {
    if (!Array.isArray(entries) || entries.length < 2) return [];
    return [...entries.slice(0, -1)].reverse();
}

export function formatFuelEntryWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
