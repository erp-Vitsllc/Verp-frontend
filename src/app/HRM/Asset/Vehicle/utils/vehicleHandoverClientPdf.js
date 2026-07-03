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
    canvasToCompressedJpeg,
    compressImagesInElement,
    restoreImageSources,
    snapshotImageSources,
    waitForFontsAndImagesInElement,
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
    await waitForFontsAndImagesInElement(root);
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
            }),
        );
    } finally {
        pageEl.removeAttribute('id');
        restore();
    }
}

async function buildPdfBlob(targets, { quality, scale, canvasMaxWidth }) {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

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
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'SLOW');
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
        const imageSnapshots = snapshotImageSources(root);
        let imageMaxEdge = PDF_IMAGE_MAX_EDGE;

        try {
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
        } finally {
            restoreImageSources(imageSnapshots);
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
}
