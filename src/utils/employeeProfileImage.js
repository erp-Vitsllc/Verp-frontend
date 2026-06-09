const PLACEHOLDER_PATHS = new Set([
    '/default-avatar.png',
    '/default-avatar.svg',
    'default-avatar.png',
    'default-avatar.svg',
]);

/** Legacy DB / UI placeholders — treat as no photo so we show initials instead of 404s. */
export function normalizeProfilePictureUrl(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object' && raw.url) return normalizeProfilePictureUrl(raw.url);
    if (typeof raw !== 'string') return null;

    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[object Object]') return null;

    const pathOnly = trimmed.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
    if (PLACEHOLDER_PATHS.has(pathOnly) || PLACEHOLDER_PATHS.has(trimmed)) return null;

    return trimmed;
}

export function getPendingProfilePictureSrc(employeeOrUser) {
    if (!employeeOrUser) return null;
    const list = Array.isArray(employeeOrUser.pendingReactivationChanges)
        ? employeeOrUser.pendingReactivationChanges
        : [];
    const row = list.find(
        (change) =>
            String(change?.section || '').toLowerCase() === 'basicdetails' &&
            change?.proposedData?.profilePicture,
    );
    if (!row?.proposedData) return null;
    const { profilePictureDisplayUrl, profilePicture } = row.proposedData;
    return (
        normalizeProfilePictureUrl(profilePictureDisplayUrl) ||
        normalizeProfilePictureUrl(profilePicture)
    );
}

export function getEmployeeProfilePictureSrc(employeeOrUser) {
    if (!employeeOrUser) return null;
    const pending = getPendingProfilePictureSrc(employeeOrUser);
    const live = normalizeProfilePictureUrl(
        employeeOrUser.profilePicture || employeeOrUser.profilePic || employeeOrUser.avatar,
    );
    return pending || live;
}

export function hasPendingProfilePictureChange(employeeOrUser) {
    return Boolean(getPendingProfilePictureSrc(employeeOrUser));
}

export function getEmployeeInitials(firstName, lastName) {
    const a = (firstName || '').trim()[0] || '';
    const b = (lastName || '').trim()[0] || '';
    return `${a}${b}`.toUpperCase() || '?';
}

/** Safe src for next/image — keeps absolute paths and data URLs; adds https only for bare host strings. */
export function toNextImageProfileSrc(url) {
    const normalized = normalizeProfilePictureUrl(url);
    if (!normalized) return null;
    if (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('/') ||
        normalized.startsWith('data:')
    ) {
        return normalized;
    }
    return `https://${normalized}`;
}
