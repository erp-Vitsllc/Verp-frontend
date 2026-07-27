import axiosInstance from '@/utils/axios';
import { validateErpJpegFile } from '@/utils/uploadFileTypes';
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

/** Fetch a fresh signed URL for handover/accessories photos stored as S3 keys. */
export async function fetchSignedAssessmentMediaUrl(photo) {
    const direct = resolveAssessmentMediaUrl(photo);
    if (direct?.startsWith('data:')) return direct;

    const key = normalizeHandoverPhotoIdentity(photo);
    if (!key || key.startsWith('data:')) {
        return direct;
    }

    try {
        const response = await axiosInstance.get('/storage/signed-url', {
            params: { key },
            skipToast: true,
        });
        return response?.data?.url || direct || null;
    } catch {
        return direct || null;
    }
}
