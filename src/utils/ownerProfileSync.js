import { mergeCompanyOwnersSnapshot } from '@/utils/mergeCompanyPendingActivationProposed';
import { ownerDocHasContent } from '@/utils/companyPermissionModules';
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

/**
 * Map a live `company.owners` index (stored on expiry notifications) to an owner tab index
 * in deduped `ownersForDisplay`.
 */
export function resolveDisplayOwnerTabIndexFromLiveIndex(company, liveIdx, ownersForDisplay = []) {
    const liveOwners = Array.isArray(company?.owners) ? company.owners : [];
    const displayList = Array.isArray(ownersForDisplay) ? ownersForDisplay : [];

    if (typeof liveIdx !== 'number' || liveIdx < 0) return 0;
    if (!displayList.length) {
        return liveIdx < liveOwners.length ? liveIdx : 0;
    }
    if (liveIdx < displayList.length && !liveOwners.length) {
        return liveIdx;
    }

    const liveOwner = liveOwners[liveIdx];
    if (!liveOwner) {
        return liveIdx < displayList.length ? liveIdx : 0;
    }

    const profileId = resolveOwnerProfileId(liveOwner);
    if (profileId) {
        const byProfile = displayList.findIndex((o) => resolveOwnerProfileId(o) === profileId);
        if (byProfile >= 0) return byProfile;
    }

    const rowId = liveOwner._id ?? liveOwner.id;
    if (rowId != null) {
        const byId = displayList.findIndex(
            (o) => String(o?._id ?? o?.id ?? '') === String(rowId),
        );
        if (byId >= 0) return byId;
    }

    const nameKey = String(liveOwner.name || '').trim().toLowerCase();
    if (nameKey) {
        const byName = displayList.findIndex(
            (o) => String(o?.name || '').trim().toLowerCase() === nameKey,
        );
        if (byName >= 0) return byName;
    }

    return liveIdx < displayList.length ? liveIdx : 0;
}

/** Map a display-tab owner to the matching row in `company.owners` (live partition only). */
export function resolveLiveOwnerIndex(company, displayOwner, tabIndex = 0) {
    const liveOwners = Array.isArray(company?.owners) ? company.owners : [];
    if (!liveOwners.length) return -1;

    const profileId = resolveOwnerProfileId(displayOwner);
    if (profileId) {
        const byProfile = liveOwners.findIndex((o) => resolveOwnerProfileId(o) === profileId);
        if (byProfile >= 0) return byProfile;
    }

    const rowId = displayOwner?._id ?? displayOwner?.id;
    if (rowId != null) {
        const byId = liveOwners.findIndex((o) => String(o?._id ?? o?.id ?? '') === String(rowId));
        if (byId >= 0) return byId;
    }

    return typeof tabIndex === 'number' && tabIndex >= 0 && tabIndex < liveOwners.length ? tabIndex : -1;
}

export function resolveLiveOwnerRow(company, displayOwner, tabIndex = 0) {
    const idx = resolveLiveOwnerIndex(company, displayOwner, tabIndex);
    if (idx < 0) return null;
    return company?.owners?.[idx] ?? null;
}

/** Passport / EID use the HR queue overlay; other owner doc cards save immediately on live data. */
export function isHrQueuedOwnerDocKey(docKey) {
    const key = String(docKey || '').trim();
    return key === 'passport' || key === 'emiratesId';
}

/** Find the live owner row that holds a nested document (handles duplicate roster rows). */
export function resolveLiveOwnerDocSlot(company, displayOwner, tabIndex = 0, docKey = '') {
    const key = String(docKey || '').trim();
    if (!key) return null;

    const liveOwners = Array.isArray(company?.owners) ? company.owners : [];
    const profileId = resolveOwnerProfileId(displayOwner);
    if (profileId) {
        for (let i = 0; i < liveOwners.length; i++) {
            const row = liveOwners[i];
            if (resolveOwnerProfileId(row) === profileId && ownerDocHasContent(row?.[key])) {
                return { ownerIndex: i, owner: row, doc: row[key] };
            }
        }
    }

    const idx = resolveLiveOwnerIndex(company, displayOwner, tabIndex);
    if (idx >= 0 && ownerDocHasContent(liveOwners[idx]?.[key])) {
        return { ownerIndex: idx, owner: liveOwners[idx], doc: liveOwners[idx][key] };
    }

    return null;
}

const OWNER_CATALOG_CONTACT_KEYS = ['email', 'phone', 'phoneCountryCode', 'nationality'];

/** Fill missing contact fields only — never overlay passport / EID / visa from other companies. */
export function enrichOwnerContactFromCatalog(owner, catalogRow) {
    if (!owner || !catalogRow) return owner;
    const out = { ...owner };
    for (const key of OWNER_CATALOG_CONTACT_KEYS) {
        const current = out[key];
        const fromCatalog = catalogRow[key];
        if (
            (current == null || String(current).trim() === '') &&
            fromCatalog != null &&
            String(fromCatalog).trim() !== ''
        ) {
            out[key] = fromCatalog;
        }
    }
    return out;
}
