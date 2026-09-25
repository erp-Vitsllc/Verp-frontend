import axiosInstance from '@/utils/axios';
import {
    ERP_ATTACHMENT_ACCEPT,
    ERP_ATTACHMENT_HINT,
    guardAttachmentFileChange as guardErpAttachmentFileChange,
    isAllowedAttachmentFile as isErpAllowedAttachmentFile,
    validateAttachmentFile as validateErpAttachmentFile,
} from '@/utils/uploadFileTypes';

/** File picker: PDF and JPEG only (see uploadFileTypes.js). */
export { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT };

export const ALLOWED_ATTACHMENT_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/jpg']);

function pickMimeFromName(fileName, fallback = 'application/pdf') {
    const n = String(fileName || '').toLowerCase();
    if (/\.png(?:$|\?|#)/i.test(n)) return 'image/png';
    if (/\.jpe?g(?:$|\?|#)/i.test(n)) return 'image/jpeg';
    if (/\.pdf(?:$|\?|#)/i.test(n)) return 'application/pdf';
    return fallback;
}

function firstResolvedMime(hints, fallback = 'application/pdf') {
    for (const hint of hints) {
        if (!hint) continue;
        const mime = pickMimeFromName(hint, '');
        if (mime) return mime;
    }
    return fallback;
}

/**
 * Prefix https:// on protocol-less S3/Wasabi host URLs.
 * Browsers treat `s3.…` / `….wasabisys.com/…` as relative paths (ERR_NAME_NOT_RESOLVED).
 */
export function ensureAbsoluteHttpUrl(value) {
    if (typeof value !== 'string') return '';
    const s = value.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('blob:')) {
        return s;
    }
    if (s.startsWith('//') && (/wasabisys\.com/i.test(s) || /\.amazonaws\.com/i.test(s) || /^\/\/s3[.-]/i.test(s))) {
        return `https:${s}`;
    }
    if (
        /^s3\./i.test(s) ||
        /(?:^|\.)wasabisys\.com(?:[/:?]|$)/i.test(s) ||
        /\.amazonaws\.com(?:[/:?]|$)/i.test(s)
    ) {
        return `https://${s.replace(/^\/+/, '')}`;
    }
    return s;
}

function isHttpUrl(value) {
    if (typeof value !== 'string') return false;
    const s = ensureAbsoluteHttpUrl(value);
    return s.startsWith('http://') || s.startsWith('https://');
}

export function isInlineDocumentData(value) {
    const s = String(value || '').trim();
    return s.startsWith('data:') || s.startsWith('blob:');
}

const S3_STORAGE_FOLDER_PREFIXES = [
    'admin-deletion-archive',
    'asset-documents',
    'asset-invoices',
    'asset-photos',
    'asset-service-invoices',
    'asset-service-attachments',
    'asset-services',
    'asset-history',
    'asset-accessories',
    'asset-service-workflow-completion',
    'asset-negotiation',
    'asset-ld-company-approved-handover',
    'asset-accessory-request-handover',
    'employee-documents',
    'employee-profiles',
    'employee-signatures',
    'profile-pictures',
    'user-profiles',
    'signatures',
    'rewards',
    'fines',
    'loans',
    'company-documents',
    'salary-policy',
];

function storagePrefixInString(value) {
    const s = String(value || '');
    return S3_STORAGE_FOLDER_PREFIXES.some(
        (prefix) => s.includes(`/${prefix}/`) || s.includes(`${prefix}/`) || s.startsWith(`${prefix}/`),
    );
}

/** Drop a signed-link query so it is never stored as part of the object name. */
export function stripSignatureFromStorageKey(value) {
    let s = String(value || '').trim();
    if (!s) return '';
    const encodedQuery = s.search(/%3[fF]/);
    if (encodedQuery !== -1) s = s.slice(0, encodedQuery);
    try {
        if (s.includes('%')) s = decodeURIComponent(s);
    } catch {
        /* keep the cut value */
    }
    const cut = s.search(/[?#]|X-Amz-|AWSAccessKeyId=|Signature=/i);
    if (cut !== -1) s = s.slice(0, cut);
    return s.replace(/[/?&#]+$/g, '').replace(/^\/+/, '');
}

export function looksLikeS3StorageKey(value) {
    if (typeof value !== 'string') return false;
    const key = stripSignatureFromStorageKey(value);
    if (!key || key.startsWith('data:') || isHttpUrl(key)) return false;
    if (/[?#]|X-Amz-|%3[fF]/i.test(key)) return false;
    if (S3_STORAGE_FOLDER_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}/`))) {
        return true;
    }
    // Allow spaces / parentheses in filenames: folder/Report (2).pdf
    return /^[\w.-]+\/.+\.(pdf|jpe?g|png)$/i.test(key);
}

function looksLikeRawBase64(value) {
    const s = String(value || '').replace(/\s/g, '');
    if (s.length < 80 || s.startsWith('/') || s.startsWith('http') || s.startsWith('data:')) return false;
    if (s.includes('://') || storagePrefixInString(s)) return false;
    return /^[A-Za-z0-9+/=]+$/.test(s);
}

function isAppRouteUrl(value) {
    if (typeof value !== 'string') return false;
    const s = ensureAbsoluteHttpUrl(value.trim());
    if (!s) return false;
    if (looksLikeS3StorageKey(s) || storagePrefixInString(s) || looksLikeRawBase64(s)) return false;
    if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return true;
    if (!isHttpUrl(s)) return false;
    try {
        const parsed = new URL(s);
        if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
            const path = parsed.pathname || '';
            if (storagePrefixInString(path) || storagePrefixInString(parsed.search || '')) return false;
            if (path.startsWith('/api/storage')) return false;
            if (!path.includes('.') || path.endsWith('.html')) return true;
        }
    } catch {
        return false;
    }
    return false;
}

export function isLikelySignedStorageUrl(url) {
    if (!isHttpUrl(url)) return false;
    const s = String(url);
    if (
        /X-Amz-|Signature=|AWSAccessKeyId=|wasabisys|idrive|amazonaws|\.s3\.|digitaloceanspaces|r2\.cloudflarestorage|backblazeb2/i.test(
            s,
        )
    ) {
        return true;
    }
    return storagePrefixInString(s);
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

    const toKey = (raw) => {
        const s = String(raw || '').trim();
        if (!s) return '';
        const stripped = stripSignatureFromStorageKey(s);
        if (looksLikeS3StorageKey(stripped)) return stripped;
        if (isHttpUrl(s) || storagePrefixInString(s)) {
            for (const folder of S3_STORAGE_FOLDER_PREFIXES) {
                const idx = s.indexOf(folder);
                if (idx === -1) continue;
                const fromFolder = stripSignatureFromStorageKey(s.substring(idx));
                if (looksLikeS3StorageKey(fromFolder)) return fromFolder;
            }
        }
        return '';
    };

    if (typeof input === 'object' && !Array.isArray(input)) {
        const publicId = input.publicId ? String(input.publicId).trim() : '';
        const url = input.url || input.href;
        const urlStr = url ? ensureAbsoluteHttpUrl(String(url).trim()) : '';
        if (publicId) {
            const key = toKey(publicId);
            const url = urlStr || (isHttpUrl(publicId) ? ensureAbsoluteHttpUrl(publicId) : '');
            return { key, url, name: input.name || input.fileName };
        }
        if (isInlineDocumentData(urlStr)) {
            return null;
        }
        if (urlStr) {
            const key = toKey(urlStr) || urlStr;
            return { key, url: urlStr, name: input.name || input.fileName };
        }
        return null;
    }

    const s = String(input).trim();
    if (!s || s.startsWith('data:')) return null;
    const normalized = ensureAbsoluteHttpUrl(s);
    const key = toKey(normalized) || toKey(s) || s;
    return { key, url: normalized, name: null };
}

/**
 * Key or URL safe to pass to GET /storage/file (backend normalizeS3Key).
 * Prefer short S3 keys; fall back to the full storage URL when the key cannot be parsed.
 */
export function resolveStorageProxyKey(attachment) {
    const ref = extractStorageReference(attachment);
    if (!ref?.key || !looksLikeS3StorageKey(ref.key)) return null;
    return stripSignatureFromStorageKey(ref.key);
}

export function isAllowedAttachmentFile(file) {
    return isErpAllowedAttachmentFile(file);
}

export function validateAttachmentFile(file) {
    return validateErpAttachmentFile(file);
}

export function guardAttachmentFileChange(event, onAllowed) {
    return guardErpAttachmentFileChange(event, onAllowed);
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
            if (isInlineDocumentData(urlStr)) return { data: urlStr, name: fileName, mimeType: mime };
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

/** Parse API error when axios used responseType: 'blob' (JSON body arrives as Blob). */
async function messageFromAxiosBlobError(err) {
    const data = err?.response?.data;
    if (typeof data?.message === 'string' && data.message) return data.message;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (typeof parsed?.message === 'string' && parsed.message) return parsed.message;
        } catch {
            /* ignore */
        }
    }
    return null;
}

/**
 * Load file bytes via authenticated API proxy.
 * Do not fall back to Wasabi signed URLs in the browser — many office networks
 * (Windows/ISP DNS) cannot resolve wasabisys.com even when the API can.
 */
function storageFileRequestKey(storageKey) {
    const raw = String(storageKey || '').trim();
    if (!raw) return '';
    const cleaned = stripSignatureFromStorageKey(raw);
    if (looksLikeS3StorageKey(cleaned)) return cleaned;
    const ref = extractStorageReference(raw);
    if (ref?.key && looksLikeS3StorageKey(ref.key)) return stripSignatureFromStorageKey(ref.key);
    return '';
}

export async function loadStorageFileBlob(storageKey, { expectedMime } = {}) {
    const key = storageFileRequestKey(storageKey);
    if (!key) throw new Error('File not found in storage.');
    const requestConfig = {
        responseType: 'blob',
        skipToast: true,
        timeout: 20000,
        headers: { 'x-no-compression': '1' },
    };
    try {
        const response = key.length > 1800
            ? await axiosInstance.post('/storage/file', { key }, requestConfig)
            : await axiosInstance.get('/storage/file', {
                ...requestConfig,
                params: { key },
            });
        const blob = response.data;
        const type = (blob?.type || '').toLowerCase();
        if (isNonDocumentResponseContentType(type)) {
            throw new Error('File not found in storage or access denied.');
        }
        if (blob && blob.size < 8192) {
            const head = await blob.slice(0, 400).text();
            if (/NoSuchKey|<Error|Specified key does not exist/i.test(head)) {
                throw new Error('File not found in storage.');
            }
        }
        if (expectedMime && blob && !blob.type) {
            return new Blob([blob], { type: expectedMime });
        }
        return blob;
    } catch (err) {
        const status = err.response?.status ?? err.originalError?.response?.status;
        const apiMsg = await messageFromAxiosBlobError(err);
        if (apiMsg) throw new Error(apiMsg);
        if (status === 404) {
            throw new Error('File not found in storage.');
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
    const coalescedMime =
        typeof coalesced === 'object' ? coalesced.mimeType || coalesced.mime : '';
    const resolvedMime =
        coalescedMime ||
        mimeType ||
        firstResolvedMime([
            fileName,
            ref?.name,
            ref?.key,
            ref?.url,
            typeof coalesced === 'string' ? coalesced : '',
            typeof coalesced === 'object' ? coalesced.url || coalesced.publicId || coalesced.href : '',
        ]);
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
    const ref = extractStorageReference(input);
    const proxyKey = resolveStorageProxyKey(input);
    const shortKey = proxyKey && looksLikeS3StorageKey(proxyKey) ? proxyKey : '';
    const directUrl = ref?.url && isHttpUrl(ref.url) ? ensureAbsoluteHttpUrl(ref.url) : '';
    const sync = normalizeAttachmentForViewer(input, { name, mimeType });
    const inlineData = sync && !sync.error && typeof sync.data === 'string' && sync.data.startsWith('data:')
        ? sync.data
        : null;

    // Keep the original link. A storage-only payload hides the file everywhere
    // (company, employee, vehicle) when the storage request does not return.
    if (shortKey) {
        const { fileName, resolvedMime } = resolveStorageViewerMeta(
            input,
            ref || { key: shortKey, url: directUrl || shortKey, name: null },
            { name, mimeType },
        );
        return {
            storageRef: shortKey,
            data: directUrl || inlineData || null,
            name: fileName,
            mimeType: resolvedMime,
        };
    }

    if (directUrl || (proxyKey && isHttpUrl(proxyKey))) {
        const url = directUrl || ensureAbsoluteHttpUrl(proxyKey);
        const { fileName, resolvedMime } = resolveStorageViewerMeta(
            input,
            ref || { key: url, url, name: null },
            { name, mimeType },
        );
        return { data: url, name: fileName, mimeType: resolvedMime };
    }

    if (sync && !sync.error) return sync;

    return sync || { error: 'Attachment file is missing or unavailable.' };
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

    // Drop file bytes from the tab handoff. Keep a normal http link so the viewer
    // can still open the file when the storage request fails.
    const data = typeof record.data === 'string' ? record.data : '';
    const dataIsFileBytes = data.startsWith('data:') || data.length > 12000;
    const persisted = dataIsFileBytes ? { ...record, data: null } : record;

    try {
        localStorage.setItem(key, JSON.stringify(persisted));
        return id;
    } catch {
        if (record.storageRef) {
            try {
                localStorage.setItem(
                    key,
                    JSON.stringify({
                        ...record,
                        data: null,
                    }),
                );
                return id;
            } catch {
                /* browser storage is full — open the stored file directly below */
            }
        }
        const err = new Error('LOCAL_VIEWER_STORAGE_FULL');
        err.inlinePayload = record;
        throw err;
    }
}

function openInlineAttachmentInWindow(payload, preOpenedWindow) {
    const raw = payload?.data;
    if (typeof raw !== 'string' || !raw) return false;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        openUrlForDocumentViewer(raw, preOpenedWindow);
        return true;
    }
    try {
        let mime = payload.mimeType || 'application/pdf';
        let b64 = raw;
        if (raw.startsWith('blob:')) {
            openUrlForDocumentViewer(raw, preOpenedWindow);
            return true;
        }
        if (raw.startsWith('data:')) {
            const comma = raw.indexOf(',');
            const header = comma >= 0 ? raw.slice(0, comma) : '';
            b64 = comma >= 0 ? raw.slice(comma + 1) : '';
            const found = header.match(/data:([^;,]+)/);
            if (found?.[1]) mime = found[1];
        }
        if (!b64) return false;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        openUrlForDocumentViewer(url, preOpenedWindow);
        return true;
    } catch {
        return false;
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

function toAbsoluteAppUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (/^(https?:|blob:|data:)/i.test(url)) return url;
    if (typeof window === 'undefined') return url;
    try {
        return new URL(url, window.location.origin).href;
    } catch {
        return url;
    }
}

function openUrlForDocumentViewer(url, preOpenedWindow) {
    const absoluteUrl = toAbsoluteAppUrl(url);
    if (preOpenedWindow && !preOpenedWindow.closed) {
        try {
            // Safari resolves relative hrefs against about:blank (not the app origin).
            preOpenedWindow.location.href = absoluteUrl;
            detachPreviewTabOpener(preOpenedWindow);
            return true;
        } catch {
            /* try fallbacks */
        }
    }

    try {
        const link = document.createElement('a');
        link.href = absoluteUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch {
        /* try window.open */
    }

    const opened = window.open(absoluteUrl, '_blank');
    if (opened) {
        detachPreviewTabOpener(opened);
        return true;
    }

    window.location.assign(absoluteUrl);
    return true;
}

/** Open resolved viewer payload in a new browser tab. */
export function openDocumentViewerFromPayload(payload, { preOpenedWindow } = {}) {
    if (!payload || payload.loading || payload.error) {
        return { ok: false, error: payload?.error || 'Invalid document' };
    }
    try {
        const id = storeDocumentViewerSessionPayload(payload);
        const path = `/view-document?id=${encodeURIComponent(id)}`;
        openUrlForDocumentViewer(path, preOpenedWindow);
        return { ok: true };
    } catch (err) {
        const storageRef = payload.storageRef || err.inlinePayload?.storageRef;
        if (storageRef) {
            const target = preOpenedWindow && !preOpenedWindow.closed ? preOpenedWindow : openBlankPreviewTab();
            loadStorageFileBlob(storageRef)
                .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    openUrlForDocumentViewer(url, target);
                })
                .catch(() => {
                    if (target && !target.closed) {
                        try {
                            target.close();
                        } catch {
                            /* ignore */
                        }
                    }
                });
            return { ok: true };
        }
        if (openInlineAttachmentInWindow(err.inlinePayload || payload, preOpenedWindow)) {
            return { ok: true };
        }
        if (preOpenedWindow && !preOpenedWindow.closed) {
            try {
                preOpenedWindow.close();
            } catch {
                /* ignore */
            }
        }
        const message =
            err?.message === 'LOCAL_VIEWER_STORAGE_FULL'
                ? 'Could not open document.'
                : err.message || 'Could not open document.';
        return { ok: false, error: message };
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
