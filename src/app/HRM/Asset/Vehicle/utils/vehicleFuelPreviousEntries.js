/** Latest entry stays on the main row. Older entries are previous fuels. */
export function previousFuelEntries(entries = []) {
    if (!Array.isArray(entries) || entries.length < 2) return [];
    return [...entries.slice(0, -1)].reverse();
}

export function latestFuelEntry(entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    return entries[entries.length - 1];
}

/** Current fill-up first, then older fills (first fuel last). */
export function fuelEntryHistoryRows(entries = []) {
    const latest = latestFuelEntry(entries);
    const previous = previousFuelEntries(entries);
    const rows = [];
    if (latest) {
        rows.push({ entry: latest, label: 'Current', isCurrent: true });
    }
    previous.forEach((entry, idx) => {
        rows.push({
            entry,
            label: idx === previous.length - 1 ? 'First fuel' : 'Previous',
            isCurrent: false,
        });
    });
    return rows;
}

export function formatFuelEntryWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
