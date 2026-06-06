import { mergeCompanyOwnersSnapshot } from '@/utils/mergeCompanyPendingActivationProposed';
import {
    normalizeOwnerProfileId,
    resolveOwnerProfileId,
} from '@/utils/ownerProfileId';

/** Collapse duplicate owner tabs (same ownerProfileId, else same name). */
export function dedupeCompanyOwnersForDisplay(owners = []) {
    const result = [];
    const profileIndex = new Map();
    const nameIndex = new Map();

    for (const raw of owners) {
        if (!raw || typeof raw !== 'object') continue;
        const profileId = normalizeOwnerProfileId(raw.ownerProfileId);
        const nameKey = String(raw.name || '').trim().toLowerCase();

        let targetIdx = -1;
        if (profileId && profileIndex.has(profileId)) {
            targetIdx = profileIndex.get(profileId);
        } else if (!profileId && nameKey && nameIndex.has(nameKey)) {
            targetIdx = nameIndex.get(nameKey);
        }

        if (targetIdx >= 0) {
            result[targetIdx] = mergeCompanyOwnersSnapshot([result[targetIdx]], [raw])[0];
            const mergedPid = normalizeOwnerProfileId(result[targetIdx].ownerProfileId);
            if (mergedPid && !profileIndex.has(mergedPid)) {
                profileIndex.set(mergedPid, targetIdx);
            }
            continue;
        }

        targetIdx = result.length;
        result.push({ ...raw });
        if (profileId) profileIndex.set(profileId, targetIdx);
        else if (nameKey) nameIndex.set(nameKey, targetIdx);
    }

    return result;
}

export function ownerProfileExistsOnActiveCompany(profileId, companies = [], excludeCompanyId = null) {
    const pid = normalizeOwnerProfileId(profileId);
    if (!pid) return false;
    return (companies || []).some((comp) => {
        if (excludeCompanyId && String(comp?._id) === String(excludeCompanyId)) return false;
        if (String(comp?.status || '').toLowerCase() !== 'active') return false;
        return (comp?.owners || []).some(
            (o) => normalizeOwnerProfileId(o?.ownerProfileId) === pid,
        );
    });
}

/** Owner linked to an activated company may only be edited from an active company profile. */
export function canMutateOwnerInCompany(owner, { companies = [], currentCompany = null, isAdmin = false } = {}) {
    if (isAdmin) return true;
    const pid = resolveOwnerProfileId(owner);
    if (!pid) return true;

    const anyActiveHost = (companies || []).some((comp) => {
        if (String(comp?.status || '').toLowerCase() !== 'active') return false;
        return (comp?.owners || []).some((o) => resolveOwnerProfileId(o) === pid);
    });
    if (!anyActiveHost) return true;

    return String(currentCompany?.status || '').toLowerCase() === 'active';
}

export function ownerMutationBlockedReason(owner, { companies = [], currentCompany = null, isAdmin = false } = {}) {
    if (canMutateOwnerInCompany(owner, { companies, currentCompany, isAdmin })) return '';
    const pid = resolveOwnerProfileId(owner);
    return pid
        ? `Owner ${pid} is on an activated company. Edit this owner only from that active company profile.`
        : 'This owner is on an activated company. Edit only from the active company profile.';
}
