import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildHtml2CanvasOptions } from '@/utils/html2canvasSafeCapture';
import {
    PDF_A4_HEIGHT_PX,
    PDF_A4_WIDTH_PX,
    PDF_CANVAS_MAX_WIDTH,
    PDF_CAPTURE_SCALE,
    PDF_DOWNLOAD_MAX_BYTES,
    PDF_IMAGE_MAX_EDGE,
    PDF_JPEG_QUALITY,
    PDF_LETTERHEAD_BG_URL,
    PDF_PAGE_SURFACE_CLASS,
    PDF_PAGE_SURFACE_COMPACT_CLASS,
} from './vehicleHandoverFormPdfConstants';
import {
    applyLetterheadInlineStyles,
    canvasToCompressedJpeg,
    compressImagesInElement,
    prepareImagesForPdfCapture,
    restoreImageSources,
    snapshotImageSources,
    syncCapturedStylesInClone,
} from './compressImageForPdf';

const CAPTURE_ROOT_ID = 'vehicle-handover-form-view';

function preloadImage(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve();
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
    });
}

async function preloadCaptureAssets(root) {
    await preloadImage(PDF_LETTERHEAD_BG_URL);
    await prepareImagesForPdfCapture(root, {
        maxEdge: PDF_IMAGE_MAX_EDGE,
        quality: PDF_JPEG_QUALITY,
        pageSurfaceClass: PDF_PAGE_SURFACE_CLASS,
    });
}

function syncLetterheadsInClone(clonedDoc, captureId) {
    const cloneRoot = clonedDoc.getElementById(captureId);
    const liveRoot = document.getElementById(captureId);
    if (!cloneRoot || !liveRoot) return;

    cloneRoot.style.position = 'relative';
    cloneRoot.style.overflow = 'hidden';
    cloneRoot.style.backgroundColor = '#ffffff';

    const cloneContent = cloneRoot.querySelector(`.${PDF_PAGE_SURFACE_CLASS}__content`);
    if (cloneContent) {
        cloneContent.style.position = 'relative';
        cloneContent.style.zIndex = '1';
    }

    const liveLetterheads = Array.from(liveRoot.querySelectorAll('[data-pdf-letterhead="true"]'));
    const cloneLetterheads = Array.from(cloneRoot.querySelectorAll('[data-pdf-letterhead="true"]'));

    cloneLetterheads.forEach((cloneImg, index) => {
        const liveImg = liveLetterheads[index];
        applyLetterheadInlineStyles(cloneImg);
        if (liveImg?.currentSrc || liveImg?.src) {
            cloneImg.src = liveImg.currentSrc || liveImg.src;
        }
    });
}

function preparePageElementForCapture(pageEl) {
    const isCompact = pageEl.classList.contains(PDF_PAGE_SURFACE_COMPACT_CLASS);

    const restore = {
        width: pageEl.style.width,
        height: pageEl.style.height,
        boxShadow: pageEl.style.boxShadow,
        border: pageEl.style.border,
        margin: pageEl.style.margin,
        flexShrink: pageEl.style.flexShrink,
        boxSizing: pageEl.style.boxSizing,
    };

    pageEl.style.boxSizing = 'border-box';
    pageEl.style.width = `${PDF_A4_WIDTH_PX}px`;
    pageEl.style.height = isCompact ? 'auto' : `${PDF_A4_HEIGHT_PX}px`;
    pageEl.style.boxShadow = 'none';
    pageEl.style.border = 'none';
    pageEl.style.margin = '0';
    pageEl.style.flexShrink = '0';

    const captureHeight = isCompact
        ? Math.ceil(Math.max(pageEl.scrollHeight, pageEl.offsetHeight))
        : PDF_A4_HEIGHT_PX;

    return {
        captureHeight,
        restore: () => {
            pageEl.style.width = restore.width;
            pageEl.style.height = restore.height;
            pageEl.style.boxShadow = restore.boxShadow;
            pageEl.style.border = restore.border;
            pageEl.style.margin = restore.margin;
            pageEl.style.flexShrink = restore.flexShrink;
            pageEl.style.boxSizing = restore.boxSizing;
        },
    };
}

async function capturePageCanvas(pageEl, scale, captureId) {
    const { captureHeight, restore } = preparePageElementForCapture(pageEl);
    pageEl.setAttribute('id', captureId);

    await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    try {
        return await html2canvas(
            pageEl,
            buildHtml2CanvasOptions({
                rootElementId: captureId,
                scale,
                backgroundColor: '#ffffff',
                width: PDF_A4_WIDTH_PX,
                height: captureHeight,
                windowWidth: PDF_A4_WIDTH_PX,
                windowHeight: captureHeight,
                useCORS: true,
                allowTaint: false,
                logging: false,
                onclone: (clonedDoc) => {
                    syncLetterheadsInClone(clonedDoc, captureId);
                    syncCapturedStylesInClone(clonedDoc, captureId);
                },
            }),
        );
    } finally {
        pageEl.removeAttribute('id');
        restore();
    }
}

function addCanvasToPdfPage(pdf, canvas, imgData) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const aspect = canvas.width / canvas.height;
    const pageAspect = pageWidth / pageHeight;

    let renderWidth = pageWidth;
    let renderHeight = pageHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (Math.abs(aspect - pageAspect) > 0.001) {
        if (aspect > pageAspect) {
            renderHeight = pageWidth / aspect;
            offsetY = (pageHeight - renderHeight) / 2;
        } else {
            renderWidth = pageHeight * aspect;
            offsetX = (pageWidth - renderWidth) / 2;
        }
    }

    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'SLOW');
}

async function buildPdfBlob(targets, { quality, scale, canvasMaxWidth }) {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < targets.length; index += 1) {
        const pageEl = targets[index];
        pageEl.scrollIntoView({ block: 'center', inline: 'nearest' });

        const captureId = `vehicle-handover-pdf-page-${index}`;
        const canvas = await capturePageCanvas(pageEl, scale, captureId);

        const imgData = canvasToCompressedJpeg(canvas, {
            maxWidth: canvasMaxWidth,
            quality,
        });

        if (index > 0) pdf.addPage();
        addCanvasToPdfPage(pdf, canvas, imgData);
    }

    return pdf.output('blob');
}

/**
 * Rasterize the visible handover attachment preview into a PDF (WYSIWYG), max 2 MB.
 */
export async function downloadVehicleHandoverPdfFromDom({ filename, rootId = CAPTURE_ROOT_ID }) {
    const root = document.getElementById(rootId);
    if (!root) {
        throw new Error('Handover form preview is not ready yet.');
    }

    root.scrollIntoView({ block: 'center', inline: 'nearest' });

    const pageNodes = Array.from(root.querySelectorAll(`.${PDF_PAGE_SURFACE_CLASS}`));
    const targets = pageNodes.length ? pageNodes : [root];

    if (!targets.length) {
        throw new Error('Handover form preview is not ready yet.');
    }

    const imageSnapshots = snapshotImageSources(root);

    try {
        await preloadCaptureAssets(root);

        let quality = PDF_JPEG_QUALITY;
        let scale = PDF_CAPTURE_SCALE;
        let canvasMaxWidth = PDF_CANVAS_MAX_WIDTH;
        let blob = await buildPdfBlob(targets, { quality, scale, canvasMaxWidth });
        let attempts = 0;

        while (blob.size > PDF_DOWNLOAD_MAX_BYTES && attempts < 10) {
            attempts += 1;

            if (quality > 0.62) {
                quality = Math.max(0.62, quality - 0.05);
            } else if (scale > 1.5) {
                scale = Math.max(1.5, scale - 0.25);
            } else {
                canvasMaxWidth = Math.max(PDF_A4_WIDTH_PX * scale, Math.round(canvasMaxWidth * 0.92));
            }

            blob = await buildPdfBlob(targets, { quality, scale, canvasMaxWidth });
        }

        if (blob.size > PDF_DOWNLOAD_MAX_BYTES) {
            let imageMaxEdge = PDF_IMAGE_MAX_EDGE;

            while (blob.size > PDF_DOWNLOAD_MAX_BYTES && attempts < 16) {
                attempts += 1;
                imageMaxEdge = Math.max(720, Math.round(imageMaxEdge * 0.9));
                quality = Math.max(0.55, quality - 0.04);

                await compressImagesInElement(root, {
                    maxEdge: imageMaxEdge,
                    quality,
                });
                blob = await buildPdfBlob(targets, { quality, scale, canvasMaxWidth });
            }
        }

        if (!blob || blob.size > PDF_DOWNLOAD_MAX_BYTES) {
            const sizeKb = blob ? Math.round(blob.size / 1024) : 0;
            throw new Error(
                `PDF is still ${sizeKb} KB after compression (max ${Math.round(PDF_DOWNLOAD_MAX_BYTES / 1024)} KB). Try fewer photos or contact support.`,
            );
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } finally {
        restoreImageSources(imageSnapshots);
    }
}
