import axiosInstance from '@/utils/axios';
import { validateErpJpegFile } from '@/utils/uploadFileTypes';
import {
    extractStorageReference,
    loadStorageFileBlob,
    resolveStorageProxyKey,
} from '@/utils/attachmentPreview';
import {
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from './vehicleHandoverReceiverAssessment';

const IMAGE_COMPRESS_TIMEOUT_MS = 12000;
const PHOTO_UPLOAD_TIMEOUT_MS = 60000;

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** Resize camera photos before upload — keeps handover forms responsive. */
export async function compressHandoverImageFile(
    file,
    { maxWidth = 960, maxHeight = 960, quality = 0.78 } = {},
) {
    const check = validateErpJpegFile(file);
    if (!check.ok) {
        throw new Error(check.message);
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await withTimeout(
            new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Could not read image for compression.'));
                img.src = objectUrl;
            }),
            IMAGE_COMPRESS_TIMEOUT_MS,
            'Image processing timed out. Try a JPG photo (max 2 MB).',
        );

        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return readFileAsDataUrl(file);
        context.drawImage(image, 0, 0, width, height);

        return canvas.toDataURL('image/jpeg', quality);
    } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
            throw error;
        }
        throw new Error('Could not process image. Use a JPEG (.jpg / .jpeg, max 2 MB).');
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

/** Upload one handover accessory photo — returns storage key + signed preview URL. */
export async function uploadHandoverAssessmentPhoto(file, itemKey, { skipToast = true } = {}) {
    const compressed = await compressHandoverImageFile(file);
    const response = await axiosInstance.post(
        '/AssetItem/handover/upload-photo',
        {
            file: compressed,
            fileName: `${itemKey || 'accessory'}-receiver-assessment`,
        },
        { skipToast, timeout: PHOTO_UPLOAD_TIMEOUT_MS },
    );
    const publicId = response?.data?.publicId;
    const url = response?.data?.url;
    if (!publicId) {
        throw new Error('Photo upload did not return a file reference.');
    }
    return {
        publicId,
        url: typeof url === 'string' && url.startsWith('http') ? url : null,
    };
}

const assessmentMediaUrlCache = new Map();
const assessmentMediaInflight = new Map();
const MAX_PARALLEL_ASSESSMENT_MEDIA = 4;
let assessmentMediaActive = 0;
const assessmentMediaWaiters = [];

function acquireAssessmentMediaSlot() {
    return new Promise((resolve) => {
        const tryAcquire = () => {
            if (assessmentMediaActive < MAX_PARALLEL_ASSESSMENT_MEDIA) {
                assessmentMediaActive += 1;
                resolve();
                return true;
            }
            return false;
        };
        if (!tryAcquire()) assessmentMediaWaiters.push(tryAcquire);
    });
}

function releaseAssessmentMediaSlot() {
    assessmentMediaActive = Math.max(0, assessmentMediaActive - 1);
    while (assessmentMediaWaiters.length && assessmentMediaActive < MAX_PARALLEL_ASSESSMENT_MEDIA) {
        const tryAcquire = assessmentMediaWaiters.shift();
        if (tryAcquire?.()) break;
    }
}

function isInlineMediaKey(key) {
    return Boolean(key && (key.startsWith('data:') || key.startsWith('blob:')));
}

/** S3 key (or URL the API can normalize) for GET /storage/file. */
export function resolveAssessmentStorageProxyKey(photo) {
    const identity = normalizeHandoverPhotoIdentity(photo);
    if (
        identity &&
        !isInlineMediaKey(identity) &&
        !identity.startsWith('http://') &&
        !identity.startsWith('https://')
    ) {
        return identity;
    }

    const proxy = resolveStorageProxyKey(photo);
    if (proxy && !isInlineMediaKey(proxy)) {
        if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
            const ref = extractStorageReference(photo);
            if (ref?.key && !String(ref.key).startsWith('http')) return ref.key;
        }
        return proxy;
    }

    const ref = extractStorageReference(photo);
    if (ref?.key && !isInlineMediaKey(ref.key)) return ref.key;
    if (identity && !isInlineMediaKey(identity)) return identity;
    return null;
}

export function peekCachedAssessmentMediaUrl(photo) {
    const key = resolveAssessmentStorageProxyKey(photo);
    if (!key || isInlineMediaKey(key)) return null;
    return assessmentMediaUrlCache.get(key) || null;
}

/** Load handover/accessories photos via API proxy (avoids Wasabi DNS in the browser). */
export async function fetchSignedAssessmentMediaUrl(photo, { skipCache = false } = {}) {
    const direct = resolveAssessmentMediaUrl(photo);
    if (direct?.startsWith('data:') || direct?.startsWith('blob:')) return direct;

    const key = resolveAssessmentStorageProxyKey(photo);
    if (!key || isInlineMediaKey(key)) {
        return direct?.startsWith('data:') || direct?.startsWith('blob:') ? direct : null;
    }

    if (skipCache) {
        assessmentMediaUrlCache.delete(key);
    } else {
        const cached = assessmentMediaUrlCache.get(key);
        if (cached) return cached;
        const inflight = assessmentMediaInflight.get(key);
        if (inflight) return inflight;
    }

    const request = (async () => {
        await acquireAssessmentMediaSlot();
        try {
            const blob = await loadStorageFileBlob(key);
            const objectUrl = URL.createObjectURL(blob);
            assessmentMediaUrlCache.set(key, objectUrl);
            return objectUrl;
        } catch {
            return assessmentMediaUrlCache.get(key) || null;
        } finally {
            releaseAssessmentMediaSlot();
            if (assessmentMediaInflight.get(key) === request) {
                assessmentMediaInflight.delete(key);
            }
        }
    })();

    assessmentMediaInflight.set(key, request);
    return request;
}
