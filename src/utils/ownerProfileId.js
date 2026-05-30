export const OWNER_PROFILE_ID_REGEX = /^\d{4}$/;

export function isValidOwnerProfileId(value) {
    return OWNER_PROFILE_ID_REGEX.test(String(value ?? '').trim());
}

/** Normalize to zero-padded 4 digits when value is 1–9999. */
export function normalizeOwnerProfileId(value) {
    const raw = String(value ?? '').trim();
    if (OWNER_PROFILE_ID_REGEX.test(raw)) return raw;
    if (/^\d{1,4}$/.test(raw)) {
        const padded = raw.padStart(4, '0');
        if (OWNER_PROFILE_ID_REGEX.test(padded)) return padded;
    }
    return '';
}

export function generateOwnerProfileId(usedIds = new Set()) {
    for (let n = 1; n <= 9999; n += 1) {
        const id = String(n).padStart(4, '0');
        if (!usedIds.has(id)) return id;
    }
    throw new Error('No available owner IDs');
}

export function collectOwnerProfileIdsFromCompanies(companies = []) {
    const ids = new Set();
    for (const comp of companies) {
        for (const owner of [...(comp?.owners || []), ...(comp?.oldOwners || [])]) {
            const normalized = normalizeOwnerProfileId(owner?.ownerProfileId);
            if (normalized) ids.add(normalized);
        }
    }
    return ids;
}

export function collectOwnerProfileIdsFromOwnerList(owners = []) {
    const ids = new Set();
    for (const owner of owners) {
        const normalized = normalizeOwnerProfileId(owner?.ownerProfileId);
        if (normalized) ids.add(normalized);
    }
    return ids;
}

export function resolveOwnerProfileId(owner) {
    return normalizeOwnerProfileId(owner?.ownerProfileId);
}

export function validateOwnerProfileIdFormat(value) {
    if (!normalizeOwnerProfileId(value)) {
        return 'Owner ID must be a 4-digit number';
    }
    return '';
}
