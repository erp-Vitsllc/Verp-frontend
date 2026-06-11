import {
    filterProfilePendingInCurrentSubmission,
} from '@/utils/employeeActivationSections';
import { mapPendingReactivationEntriesWithIds } from '@/utils/pendingReactivationEntryId';

/**
 * Build hold/approve ids + row notes using the same sorted ids as the backend.
 */
export function buildActivationHoldPayload({
    employee,
    profileWorkflow,
    selectedChangeIds = [],
    activationHoldRowNotesByGroup = {},
    pendingReactivationDisplayGroups = [],
}) {
    const entries = mapPendingReactivationEntriesWithIds(employee?.pendingReactivationChanges || []).map(
        (entry) => ({
            ...entry,
            card: String(entry?.card || '').trim() || 'Profile change',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }),
    );
    const scoped = filterProfilePendingInCurrentSubmission(entries, profileWorkflow);
    const selected = new Set((selectedChangeIds || []).map(String));
    const rowNotesByEntryId = {};

    for (const entry of scoped) {
        const id = String(entry._id);
        if (selected.has(id)) continue;
        const group = pendingReactivationDisplayGroups.find((g) =>
            g.ids.some((gid) => String(gid) === id),
        );
        const note = group ? String(activationHoldRowNotesByGroup[group.key] || '').trim() : '';
        if (note) rowNotesByEntryId[id] = note;
    }

    const approvedChangeIds = scoped.filter((e) => selected.has(String(e._id))).map((e) => String(e._id));
    const scopeIds = scoped.map((e) => String(e._id));
    const uncheckedWithoutNotes = scoped.filter(
        (e) => !selected.has(String(e._id)) && !rowNotesByEntryId[String(e._id)],
    );

    return {
        scoped,
        scopeIds,
        approvedChangeIds,
        rowNotesByEntryId,
        uncheckedWithoutNotes,
    };
}
