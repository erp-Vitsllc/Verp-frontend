const PLACEHOLDER_FILE_NAMES = new Set([
    'click to upload',
    'click to upload pdf invoice',
    'existing file — click to replace',
    'existing invoice — click to replace',
    'existing invoice on file',
    'current file attached',
    'permit certificate',
    'optional — click to upload',
    'replace file…',
    'replace file...',
]);

export function fileNameFromStoredAttachment(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('data:')) return '';
    const withoutQuery = raw.split('?')[0];
    let last = '';
    try {
        last = decodeURIComponent(withoutQuery.split('/').filter(Boolean).pop() || '');
    } catch {
        last = withoutQuery.split('/').filter(Boolean).pop() || '';
    }
    if (!last) return '';
    const stripped = last.replace(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
        '',
    );
    return stripped || last;
}

export function resolveAttachmentDisplayName({ fileName, existingUrl, fallback = '' } = {}) {
    const name = String(fileName || '').trim();
    if (name && !PLACEHOLDER_FILE_NAMES.has(name.toLowerCase())) return name;
    return fileNameFromStoredAttachment(existingUrl) || fallback;
}

export function attachmentUrlFromDoc(doc) {
    const value = doc?.attachment ?? doc?.existingUrl ?? doc?.attachmentUrl ?? '';
    return typeof value === 'string' ? value.trim() : '';
}
