const DEFAULT_MAX_EDGE = 900;
const DEFAULT_JPEG_QUALITY = 0.52;

function isLetterheadImage(img, src) {
    return img?.dataset?.pdfLetterhead === 'true' || String(src || '').includes('handover_form_bg');
}

function loadImageFromDataUrl(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

/**
 * Fetch a remote image via HTTP (with auth when needed) and return a data URL.
 * html2canvas cannot paint cross-origin S3/API URLs; inlining fixes gray photo boxes in PDFs.
 */
function resolveFetchableImageUrl(src) {
    const trimmed = String(src || '').trim();
    if (!trimmed || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http') || trimmed.startsWith('blob:')) return trimmed;
    if (trimmed.startsWith('/') && typeof window !== 'undefined') {
        return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
}

export async function fetchImageAsDataUrl(src) {
    if (!src || typeof src !== 'string') return src;

    const trimmed = src.trim();
    if (!trimmed || trimmed.startsWith('data:')) return trimmed;

    const requestUrl = resolveFetchableImageUrl(trimmed);
    if (!requestUrl.startsWith('http') && !requestUrl.startsWith('blob:')) return trimmed;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(requestUrl, {
        mode: 'cors',
        cache: 'no-store',
        headers,
    });
    if (!response.ok) {
        throw new Error(`Image fetch failed (${response.status})`);
    }

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Shrink and re-encode an image for PDF embedding (handover downloads target up to ~2 MB total).
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
        const inlined = src.startsWith('data:') ? src : await fetchImageAsDataUrl(src);
        const img = await loadImageFromDataUrl(inlined);
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
            if (isLetterheadImage(img, src)) return;

            const compressed = await compressImageDataUrl(src, { maxEdge, quality });
            if (compressed && compressed !== src) {
                img.removeAttribute('crossorigin');
                img.src = compressed;
            }
        }),
    );

    await waitForFontsAndImagesInElement(root);
}

const LETTERHEAD_INLINE_STYLE = {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    width: '100%',
    height: '100%',
    objectFit: 'fill',
    zIndex: '0',
    pointerEvents: 'none',
    userSelect: 'none',
};

export function applyLetterheadInlineStyles(img) {
    if (!img?.style) return;
    Object.entries(LETTERHEAD_INLINE_STYLE).forEach(([key, value]) => {
        img.style[key] = value;
    });
}

/** Inline letterhead artwork and pin layout styles so html2canvas keeps the branded page background. */
export async function prepareLetterheadsForPdfCapture(root) {
    if (!root?.querySelectorAll) return;

    const letterheads = Array.from(root.querySelectorAll('[data-pdf-letterhead="true"]'));
    await Promise.all(
        letterheads.map(async (img) => {
            applyLetterheadInlineStyles(img);

            const src = img.currentSrc || img.getAttribute('src') || '';
            if (!src || src.startsWith('data:')) return;

            try {
                const dataUrl = await fetchImageAsDataUrl(src);
                if (dataUrl?.startsWith('data:')) {
                    img.removeAttribute('crossorigin');
                    img.src = dataUrl;
                }
            } catch {
                /* keep original src — inline styles still help capture */
            }
        }),
    );
}

const PDF_TABLE_BORDER = '1px solid #9ca3af';
const PDF_CELL_BORDER = '1px solid #d1d5db';

export function preparePhotoPanelsForPdfCapture(root) {
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('img[alt$=" photo"]').forEach((img) => {
        if (isLetterheadImage(img, img.currentSrc || img.getAttribute('src') || '')) return;

        img.style.objectFit = 'contain';
        img.style.objectPosition = 'center';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';

        const parent = img.parentElement;
        if (!parent) return;

        parent.style.overflow = 'hidden';
        parent.style.display = 'flex';
        parent.style.alignItems = 'center';
        parent.style.justifyContent = 'center';
        parent.style.width = '100%';
    });

    root.querySelectorAll('table').forEach((table) => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.border = PDF_TABLE_BORDER;
    });

    root.querySelectorAll('td, th').forEach((cell) => {
        cell.style.border = PDF_CELL_BORDER;
    });
}

export function syncCapturedStylesInClone(clonedDoc, captureId) {
    const cloneRoot = clonedDoc.getElementById(captureId);
    const liveRoot = document.getElementById(captureId);
    if (!cloneRoot || !liveRoot) return;

    const liveNodes = Array.from(liveRoot.querySelectorAll('img, table, td, th'));
    const cloneNodes = Array.from(cloneRoot.querySelectorAll('img, table, td, th'));

    cloneNodes.forEach((cloneNode, index) => {
        const liveNode = liveNodes[index];
        if (!(liveNode instanceof HTMLElement) || !(cloneNode instanceof HTMLElement)) return;

        if (liveNode.tagName === 'IMG') {
            if (liveNode.dataset.pdfLetterhead === 'true') return;
            const computed = window.getComputedStyle(liveNode);
            cloneNode.style.objectFit = computed.objectFit || 'contain';
            cloneNode.style.objectPosition = computed.objectPosition || 'center';
            cloneNode.style.width = computed.width;
            cloneNode.style.height = computed.height;
            cloneNode.src = liveNode.currentSrc || liveNode.src;

            const liveParent = liveNode.parentElement;
            const cloneParent = cloneNode.parentElement;
            if (liveParent && cloneParent) {
                const parentComputed = window.getComputedStyle(liveParent);
                cloneParent.style.overflow = parentComputed.overflow;
                cloneParent.style.display = parentComputed.display;
                cloneParent.style.alignItems = parentComputed.alignItems;
                cloneParent.style.justifyContent = parentComputed.justifyContent;
                cloneParent.style.width = parentComputed.width;
                cloneParent.style.height = parentComputed.height;
            }
            return;
        }

        if (liveNode.tagName === 'TABLE') {
            cloneNode.style.borderCollapse = 'collapse';
            cloneNode.style.width = '100%';
            cloneNode.style.border = PDF_TABLE_BORDER;
            return;
        }

        if (liveNode.tagName === 'TD' || liveNode.tagName === 'TH') {
            cloneNode.style.border = PDF_CELL_BORDER;
        }
    });
}

export function preparePageSurfacesForPdfCapture(root, pageSurfaceClass) {
    if (!root?.querySelectorAll || !pageSurfaceClass) return;

    root.querySelectorAll(`.${pageSurfaceClass}`).forEach((pageEl) => {
        pageEl.style.position = 'relative';
        pageEl.style.overflow = 'hidden';
        pageEl.style.backgroundColor = '#ffffff';

        const content = pageEl.querySelector(`[class*="${pageSurfaceClass}__content"]`);
        if (content) {
            content.style.position = 'relative';
            content.style.zIndex = '1';
        }
    });
}

/**
 * Wait for fonts/images, then inline remote photos as data URLs so PDF capture matches on-screen preview.
 */
export async function prepareImagesForPdfCapture(
    root,
    { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_JPEG_QUALITY, pageSurfaceClass } = {},
) {
    if (!root) return;

    await waitForFontsAndImagesInElement(root);
    preparePageSurfacesForPdfCapture(root, pageSurfaceClass);
    preparePhotoPanelsForPdfCapture(root);
    await prepareLetterheadsForPdfCapture(root);
    await compressImagesInElement(root, { maxEdge, quality });
}

/** Snapshot image sources so the live preview can be restored after PDF capture. */
export function snapshotImageSources(root) {
    if (!root?.querySelectorAll) return [];
    return Array.from(root.querySelectorAll('img')).map((img) => ({
        img,
        src: img.currentSrc || img.getAttribute('src') || '',
    }));
}

export function restoreImageSources(snapshots = []) {
    snapshots.forEach(({ img, src }) => {
        if (img && src) img.src = src;
    });
}

/** Wait for web fonts and images inside a subtree before rasterizing to PDF. */
export async function waitForFontsAndImagesInElement(root, { imageTimeoutMs = 20000 } = {}) {
    if (!root) return;

    try {
        if (document.fonts?.ready) {
            await Promise.race([
                document.fonts.ready,
                new Promise((resolve) => setTimeout(resolve, 8000)),
            ]);
        }
    } catch {
        /* ignore */
    }

    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(
            (img) =>
                new Promise((resolve) => {
                    const finish = () => resolve();
                    if (img.complete && img.naturalWidth > 0) return finish();
                    img.addEventListener('load', finish, { once: true });
                    img.addEventListener('error', finish, { once: true });
                    setTimeout(finish, imageTimeoutMs);
                }),
        ),
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
