import axiosInstance from '@/utils/axios';
import {
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from './vehicleHandoverReceiverAssessment';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/** Resize camera photos before upload — keeps handover forms responsive. */
export async function compressHandoverImageFile(
    file,
    { maxWidth = 960, maxHeight = 960, quality = 0.78 } = {},
) {
    if (!file?.type?.startsWith('image/')) {
        return readFileAsDataUrl(file);
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = objectUrl;
        });

        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return readFileAsDataUrl(file);
        context.drawImage(image, 0, 0, width, height);

        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        return canvas.toDataURL(outputType, quality);
    } catch {
        return readFileAsDataUrl(file);
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
        { skipToast },
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
