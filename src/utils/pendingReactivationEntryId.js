/** Sort pending queue the same way approve/hold controllers do. */
export function sortPendingReactivationChanges(list = []) {
    return [...(Array.isArray(list) ? list : [])].sort(
        (a, b) => new Date(a?.changedAt || 0) - new Date(b?.changedAt || 0),
    );
}

/** Stable id for a pending row — matches backend __applyId / __idStr. */
export function pendingReactivationEntryId(entry, sortedIndex) {
    const raw = entry?._id;
    if (raw != null && String(raw).trim() !== '') return String(raw);
    return String(sortedIndex);
}

export function mapPendingReactivationEntriesWithIds(list = []) {
    const sorted = sortPendingReactivationChanges(list);
    return sorted.map((entry, idx) => ({
        ...entry,
        _id: pendingReactivationEntryId(entry, idx),
    }));
}
