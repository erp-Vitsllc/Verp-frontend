/**
 * Build /emp/{id}[.slug] href used across the ERP employee profile routes.
 * Prefers business employeeId, then Mongo ObjectId.
 */
export function resolveEmployeeProfileKey(source = {}) {
    const emp = source?.employee && typeof source.employee === 'object' ? source.employee : null;
    return String(
        source.employeeId ||
            emp?.employeeId ||
            source.employeeObjectId ||
            emp?._id ||
            emp?.id ||
            '',
    ).trim();
}

export function buildEmployeeProfileHref(source = {}) {
    const emp = source?.employee && typeof source.employee === 'object' ? source.employee : null;
    const key = resolveEmployeeProfileKey(source);
    if (!key) return '';

    const first = source.firstName || emp?.firstName || '';
    const last = source.lastName || emp?.lastName || '';
    const name =
        String(source.name || '').trim() ||
        `${first} ${last}`.trim() ||
        String(emp?.employeeId || '').trim();

    const nameSlug = String(name || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const encoded = encodeURIComponent(key);
    return nameSlug ? `/emp/${encoded}.${nameSlug}` : `/emp/${encoded}`;
}
