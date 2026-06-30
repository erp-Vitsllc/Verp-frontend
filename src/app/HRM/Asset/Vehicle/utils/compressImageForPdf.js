const DEFAULT_MAX_EDGE = 900;
const DEFAULT_JPEG_QUALITY = 0.52;

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

/**
 * Shrink and re-encode an image for PDF embedding (keeps file size under ~10 MB total).
 */
export async function compressImageDataUrl(
    src,
    { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_JPEG_QUALITY } = {},
) {
    if (!src || typeof src !== 'string') return src;
    if (!src.startsWith('data:image') && !src.startsWith('http') && !src.startsWith('blob:')) {
        return src;
    }

    try {
        const img = await loadImageElement(src);
        const longest = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        const scale = Math.min(1, maxEdge / longest);
        const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return src;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        return canvas.toDataURL('image/jpeg', quality);
    } catch {
        return src;
    }
}

/** Replace <img> sources inside a DOM subtree with compressed JPEGs before PDF capture. */
export async function compressImagesInElement(
    root,
    { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_JPEG_QUALITY } = {},
) {
    if (!root?.querySelectorAll) return;

    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(async (img) => {
            const src = img.currentSrc || img.getAttribute('src') || '';
            if (!src || src.startsWith('data:image/gif')) return;

            const compressed = await compressImageDataUrl(src, { maxEdge, quality });
            if (compressed && compressed !== src) {
                img.src = compressed;
            }
        }),
    );
}

export function canvasToCompressedJpeg(
    canvas,
    { maxWidth = 992, quality = DEFAULT_JPEG_QUALITY } = {},
) {
    if (!canvas?.width || !canvas?.height) {
        return canvas?.toDataURL?.('image/jpeg', quality) || '';
    }

    const scale = Math.min(1, maxWidth / canvas.width);
    if (scale >= 1) {
        return canvas.toDataURL('image/jpeg', quality);
    }

    const target = document.createElement('canvas');
    target.width = Math.max(1, Math.round(canvas.width * scale));
    target.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = target.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', quality);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(canvas, 0, 0, target.width, target.height);
    return target.toDataURL('image/jpeg', quality);
}
