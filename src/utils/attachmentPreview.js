import axiosInstance from '@/utils/axios';

/** File picker: PDF and images (JPEG/PNG only). */
export const ERP_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

export const ALLOWED_ATTACHMENT_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

function pickMimeFromName(fileName, fallback = 'application/pdf') {
    const n = String(fileName || '').toLowerCase();
    if (/\.png($|\?)/.test(n)) return 'image/png';
    if (/\.jpe?g($|\?)/.test(n)) return 'image/jpeg';
    if (/\.pdf($|\?)/.test(n)) return 'application/pdf';
    return fallback;
}

function isHttpUrl(value) {
    return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

const S3_STORAGE_FOLDER_PREFIXES = [
    'admin-deletion-archive',
    'asset-documents',
    'asset-invoices',
    'asset-photos',
    'asset-service-invoices',
    'asset-service-attachments',
    'employee-documents',
    'employee-profiles',
    'employee-signatures',
    'profile-pictures',
    'user-profiles',
    'signatures',
    'rewards',
    'fines',
    'company-documents',
];

function storagePrefixInString(value) {
    const s = String(value || '');
    return S3_STORAGE_FOLDER_PREFIXES.some(
        (prefix) => s.includes(`/${prefix}/`) || s.includes(`${prefix}/`) || s.startsWith(`${prefix}/`),
    );
}

export function looksLikeS3StorageKey(value) {
    if (typeof value !== 'string') return false;
    const key = value.trim().replace(/^\/+/, '');
    if (!key || key.startsWith('data:') || isHttpUrl(key)) return false;
    if (S3_STORAGE_FOLDER_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}/`))) {
        return true;
    }
    return /^[\w.-]+\/[\w./-]+\.(pdf|jpe?g|png)$/i.test(key);
}

function isAppRouteUrl(value) {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (!s) return false;
    if (looksLikeS3StorageKey(s) || storagePrefixInString(s)) return false;
    if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return true;
    try {
        const parsed = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        const path = parsed.pathname || '';
        if (!isHttpUrl(s) && path.startsWith('/')) return true;
        if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
            if (!path.includes('.') || path.endsWith('.html')) return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

function isLikelySignedStorageUrl(url) {
    if (!isHttpUrl(url)) return false;
    const s = String(url);
    if (/X-Amz-|Signature=|AWSAccessKeyId=|wasabisys|idrive|amazonaws|\.s3\./i.test(s)) return true;
    return storagePrefixInString(s);
}

function looksLikeRawBase64(value) {
    const s = String(value || '').trim();
    if (!s || s.length < 80 || s.includes(' ') || s.includes('/')) return false;
    return /^[A-Za-z0-9+/=]+$/.test(s);
}

function toDataUrlIfNeeded(raw, mimeType) {
    const s = String(raw || '').trim();
    if (!s) return s;
    if (s.startsWith('data:')) return s;
    if (looksLikeRawBase64(s)) {
        return `data:${mimeType || 'application/pdf'};base64,${s}`;
    }
    return s;
}

/** Unwrap `{ file }` / mortgage row shapes before preview or signing. */
export function coalesceAttachmentInput(attachment) {
    if (attachment == null || attachment === '') return attachment;
    if (typeof attachment === 'object' && !Array.isArray(attachment)) {
        const hasOwnPayload =
            attachment.data ||
            attachment.base64 ||
            attachment.publicId ||
            attachment.url ||
            attachment.href;
        if (!hasOwnPayload && attachment.file != null) {
            return attachment.file;
        }
    }
    return attachment;
}

/** Pull S3 key / URL / publicId from stored attachment shapes. */
export function extractStorageReference(attachment) {
    const input = coalesceAttachmentInput(attachment);
    if (input == null || input === '') return null;

    if (typeof input === 'object' && !Array.isArray(input)) {
        const publicId = input.publicId ? String(input.publicId).trim() : '';
        const url = input.url || input.href;
        const urlStr = url ? String(url).trim() : '';
        if (publicId) return { key: publicId, url: urlStr || publicId, name: input.name || input.fileName };
        if (urlStr) return { key: urlStr, url: urlStr, name: input.name || input.fileName };
        return null;
    }

    const s = String(input).trim();
    if (!s || s.startsWith('data:')) return null;
    return { key: s, url: s, name: null };
}

export function isAllowedAttachmentFile(file) {
    if (!file) return false;
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const mimeOk = !type || ALLOWED_ATTACHMENT_MIMES.has(type);
    return extOk || mimeOk;
}

export function validateAttachmentFile(file) {
    if (!file) return { ok: false, message: 'No file selected.' };
    if (!isAllowedAttachmentFile(file)) {
        return { ok: false, message: 'Only PDF, JPG, and PNG files are allowed.' };
    }
    return { ok: true };
}

export function guardAttachmentFileChange(event, onAllowed) {
    const file = event?.target?.files?.[0];
    if (!file) {
        onAllowed?.(event, null);
        return null;
    }
    const check = validateAttachmentFile(file);
    if (!check.ok) {
        if (event.target) event.target.value = '';
        return { blocked: true, message: check.message };
    }
    onAllowed?.(event, file);
    return null;
}

/**
 * Sync normalize — inline base64/data URLs only. Storage keys and signed URLs need resolveAttachmentForViewer.
 * @returns {{ data: string, name: string, mimeType: string } | { error: string } | null}
 */
export function normalizeAttachmentForViewer(attachment, { name = 'Document', mimeType } = {}) {
    const input = coalesceAttachmentInput(attachment);
    if (input == null || input === '') return null;

    const fail = (message) => ({ error: message });

    if (typeof input === 'object' && !Array.isArray(input)) {
        const fileName = input.name || input.fileName || name;
        const mime = input.mimeType || input.mime || mimeType || pickMimeFromName(fileName);
        const url = input.url || input.href;
        const publicId = input.publicId;
        const rawData = input.data || input.base64;

        if (rawData) {
            const raw = String(rawData).trim();
            if (isHttpUrl(raw)) {
                if (isLikelySignedStorageUrl(raw)) return null;
                return { data: raw, name: fileName, mimeType: mime };
            }
            if (raw.startsWith('data:')) return { data: raw, name: fileName, mimeType: mime };
            if (isAppRouteUrl(raw)) return fail('This attachment link is invalid. Re-upload the file.');
            if (looksLikeS3StorageKey(raw)) return null;
            return { data: toDataUrlIfNeeded(raw, mime), name: fileName, mimeType: mime };
        }

        if (publicId && looksLikeS3StorageKey(String(publicId).trim())) return null;
        if (publicId && isHttpUrl(String(publicId).trim())) {
            const pid = String(publicId).trim();
            if (isLikelySignedStorageUrl(pid)) return null;
            return { data: pid, name: fileName, mimeType: mime };
        }

        if (url) {
            const urlStr = String(url).trim();
            if (looksLikeS3StorageKey(urlStr) || isLikelySignedStorageUrl(urlStr)) return null;
            if (isAppRouteUrl(urlStr)) {
                return fail('This attachment link is invalid. Re-upload the file.');
            }
            if (isHttpUrl(urlStr)) return { data: urlStr, name: fileName, mimeType: mime };
        }

        return fail('Attachment file is missing or unavailable.');
    }

    const s = String(input).trim();
    if (!s) return null;
    if (isHttpUrl(s)) {
        if (isLikelySignedStorageUrl(s)) return null;
        return { data: s, name, mimeType: mimeType || pickMimeFromName(name) };
    }
    if (s.startsWith('data:')) {
        return { data: s, name, mimeType: mimeType || pickMimeFromName(name) };
    }
    if (isAppRouteUrl(s)) {
        return fail('This attachment opens the app instead of the file. Re-upload the document.');
    }
    if (looksLikeS3StorageKey(s)) return null;
    if (looksLikeRawBase64(s)) {
        return {
            data: toDataUrlIfNeeded(s, mimeType || pickMimeFromName(name)),
            name,
            mimeType: mimeType || pickMimeFromName(name),
        };
    }
    return fail('This attachment cannot be previewed. Re-upload the file or download from storage.');
}

export function attachmentLooksUnsigned(attachment) {
    const input = coalesceAttachmentInput(attachment);
    if (input == null || input === '') return false;
    if (typeof input === 'object' && !Array.isArray(input)) {
        if (input.data || input.base64) return false;
        const url = input.url || input.href;
        const publicId = input.publicId;
        if (publicId && looksLikeS3StorageKey(String(publicId))) return true;
        if (url && looksLikeS3StorageKey(String(url))) return true;
        if (url && isLikelySignedStorageUrl(String(url))) return true;
        return false;
    }
    const s = String(input).trim();
    if (!s || s.startsWith('data:')) return false;
    if (isHttpUrl(s)) return isLikelySignedStorageUrl(s);
    return looksLikeS3StorageKey(s);
}

/** Build DocumentViewer payload from employee card document (url / publicId / data in DB). */
export function employeeDocumentViewerPayload(document, { moduleId, defaultName, defaultMime = 'application/pdf' } = {}) {
    if (!document) return null;
    return {
        moduleId,
        data: document.url || document.data || document.publicId,
        publicId: document.publicId,
        name: document.name || defaultName,
        mimeType: document.mimeType || defaultMime,
    };
}

/** Load file bytes via authenticated API proxy (no presigned URL in the browser). */
export async function loadStorageFileBlob(storageKey) {
    try {
        const response = await axiosInstance.get('/storage/file', {
            params: { key: storageKey },
            responseType: 'blob',
            skipToast: true,
        });
        const blob = response.data;
        const type = (blob?.type || '').toLowerCase();
        if (isNonDocumentResponseContentType(type)) {
            throw new Error('File not found in storage or access denied.');
        }
        return blob;
    } catch (err) {
        if (err.response?.status === 404) {
            throw new Error('File not found in storage.');
        }
        const apiMsg = err.response?.data?.message;
        if (typeof apiMsg === 'string' && apiMsg) {
            throw new Error(apiMsg);
        }
        throw err;
    }
}

function resolveStorageViewerMeta(attachment, ref, { name, mimeType }) {
    const coalesced = coalesceAttachmentInput(attachment);
    const fileName =
        (typeof coalesced === 'object' && (coalesced.name || coalesced.fileName)) ||
        ref.name ||
        name;
    const resolvedMime =
        (typeof coalesced === 'object' && (coalesced.mimeType || coalesced.mime)) ||
        mimeType ||
        pickMimeFromName(fileName);
    return { fileName, resolvedMime };
}

export function extensionForMime(mimeType) {
    const m = String(mimeType || '').toLowerCase();
    if (m.includes('png')) return '.png';
    if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
    if (m.includes('pdf')) return '.pdf';
    return '.pdf';
}

export function ensureDownloadFilename(name, mimeType = 'application/pdf') {
    const base = String(name || 'document')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 200);
    const ext = extensionForMime(mimeType);
    if (/\.(pdf|jpe?g|png)$/i.test(base)) return base;
    return `${base}${ext}`;
}

export function isNonDocumentResponseContentType(contentType) {
    const t = String(contentType || '').toLowerCase();
    return (
        t.includes('text/html') ||
        t.includes('application/xml') ||
        t.includes('text/xml') ||
        (t.includes('application/json') && !t.includes('pdf'))
    );
}

/** Fetch remote attachment bytes; reject S3/API error pages (often XML). */
export async function fetchVerifiedAttachmentBlob(url, { expectedMime = 'application/pdf' } = {}) {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) {
        if (response.status === 404) throw new Error('Document not found on server (404).');
        throw new Error(`Failed to load document (Status: ${response.status})`);
    }
    const headerType = (response.headers.get('content-type') || '').toLowerCase();
    if (isNonDocumentResponseContentType(headerType)) {
        throw new Error('Server returned an error page instead of the file.');
    }
    const blobData = await response.blob();
    const blobType = (blobData.type || '').toLowerCase();
    if (isNonDocumentResponseContentType(blobType)) {
        throw new Error('File missing or link expired — storage returned an error response.');
    }
    const mime = expectedMime || blobData.type || 'application/pdf';
    return new Blob([blobData], { type: mime });
}

/**
 * Resolve DB attachment (key, publicId, expired signed URL, or inline base64) for DocumentViewer.
 */
export async function resolveAttachmentForViewer(attachment, { name = 'Document', mimeType } = {}) {
    const input = coalesceAttachmentInput(attachment);
    const sync = normalizeAttachmentForViewer(input, { name, mimeType });
    if (sync && !sync.error) return sync;

    const ref = extractStorageReference(input);
    if (!ref?.key && !ref?.url) {
        return sync || { error: 'Attachment file is missing or unavailable.' };
    }

    const { fileName, resolvedMime } = resolveStorageViewerMeta(input, ref, { name, mimeType });
    return {
        storageRef: ref.key,
        name: fileName,
        mimeType: resolvedMime,
    };
}

const DOCUMENT_VIEWER_STORAGE_PREFIX = 'erp_doc_view_';
const DOCUMENT_VIEWER_TTL_MS = 30 * 60 * 1000;

function buildDocumentViewerStorageKey(id) {
    return `${DOCUMENT_VIEWER_STORAGE_PREFIX}${id}`;
}

function purgeExpiredDocumentViewerPayloads() {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(DOCUMENT_VIEWER_STORAGE_PREFIX)) continue;
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '');
            if (!parsed?.expiresAt || parsed.expiresAt < now) {
                localStorage.removeItem(key);
            }
        } catch {
            localStorage.removeItem(key);
        }
    }
}

/** Persist viewer payload for a new tab (localStorage — shared across same-origin tabs). */
export function storeDocumentViewerSessionPayload(payload) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const key = buildDocumentViewerStorageKey(id);
    const record = {
        name: payload.name || 'Document',
        mimeType: payload.mimeType || 'application/pdf',
        data: payload.data || null,
        storageRef: payload.storageRef || null,
        allowDownload: payload.allowDownload !== false,
        loading: false,
        expiresAt: Date.now() + DOCUMENT_VIEWER_TTL_MS,
    };

    purgeExpiredDocumentViewerPayloads();

    try {
        localStorage.setItem(key, JSON.stringify(record));
        return id;
    } catch {
        if (record.storageRef) {
            localStorage.setItem(
                key,
                JSON.stringify({
                    ...record,
                    data: null,
                }),
            );
            return id;
        }
        throw new Error('Document is too large to open in a new tab. Try downloading instead.');
    }
}

export function readDocumentViewerSessionPayload(id) {
    if (!id || typeof window === 'undefined') return null;
    try {
        const storageKey = buildDocumentViewerStorageKey(id);
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.expiresAt && parsed.expiresAt < Date.now()) {
            localStorage.removeItem(storageKey);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/** Open a blank tab synchronously on user click — use before async work, then set location via openDocumentViewerFromPayload. */
export function openBlankPreviewTab() {
    if (typeof window === 'undefined') return null;
    try {
        // Do not pass noopener here: modern browsers return null while still opening about:blank,
        // which leaves the tab stuck blank after async attachment resolution.
        const win = window.open('about:blank', '_blank');
        if (win) {
            try {
                win.document.title = 'Loading document…';
            } catch {
                /* ignore until same-origin after navigation */
            }
        }
        return win;
    } catch {
        return null;
    }
}

function detachPreviewTabOpener(win) {
    if (!win || win.closed) return;
    try {
        win.opener = null;
    } catch {
        /* ignore */
    }
}

function openUrlForDocumentViewer(url, preOpenedWindow) {
    if (preOpenedWindow && !preOpenedWindow.closed) {
        try {
            preOpenedWindow.location.href = url;
            detachPreviewTabOpener(preOpenedWindow);
            return true;
        } catch {
            /* try fallbacks */
        }
    }

    try {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch {
        /* try window.open */
    }

    const opened = window.open(url, '_blank');
    if (opened) {
        detachPreviewTabOpener(opened);
        return true;
    }

    window.location.assign(url);
    return true;
}

/** Open resolved viewer payload in a new browser tab. */
export function openDocumentViewerFromPayload(payload, { preOpenedWindow } = {}) {
    if (!payload || payload.loading || payload.error) {
        return { ok: false, error: payload?.error || 'Invalid document' };
    }
    try {
        const id = storeDocumentViewerSessionPayload(payload);
        const url = `/view-document?id=${encodeURIComponent(id)}`;
        openUrlForDocumentViewer(url, preOpenedWindow);
        return { ok: true };
    } catch (err) {
        if (preOpenedWindow && !preOpenedWindow.closed) {
            try {
                preOpenedWindow.close();
            } catch {
                /* ignore */
            }
        }
        return { ok: false, error: err.message || 'Could not open document.' };
    }
}

/** Resolve attachment then open in a new tab (Company, Employee, Asset, etc.). */
export async function openDocumentViewerInNewTab(
    attachment,
    { name = 'Document', mimeType, allowDownload = true, preOpenedWindow } = {},
) {
    const resolved = await resolveAttachmentForViewer(attachment, { name, mimeType });
    if (!resolved || resolved.error) {
        if (preOpenedWindow && !preOpenedWindow.closed) {
            try {
                preOpenedWindow.close();
            } catch {
                /* ignore */
            }
        }
        return { ok: false, error: resolved?.error || 'Cannot open attachment' };
    }
    return openDocumentViewerFromPayload(
        {
            ...resolved,
            allowDownload,
        },
        { preOpenedWindow },
    );
}

/** Call directly from a click handler — opens blank tab synchronously, then loads the document. */
export async function openAttachmentInNewTab(
    attachment,
    { name = 'Document', mimeType, allowDownload = true } = {},
) {
    const preOpenedWindow = openBlankPreviewTab();
    return openDocumentViewerInNewTab(attachment, {
        name,
        mimeType,
        allowDownload,
        preOpenedWindow,
    });
}
