import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildHtml2CanvasOptions } from '@/utils/html2canvasSafeCapture';
import { PDF_PAGE_SURFACE_CLASS } from './vehicleHandoverFormPdfConstants';
import {
    canvasToCompressedJpeg,
    compressImagesInElement,
} from './compressImageForPdf';

const CAPTURE_ROOT_ID = 'vehicle-handover-form-view';

/** Tuned for ~5–10 MB total PDF (many handover photos). */
const CAPTURE_SCALE = 1.1;
const JPEG_QUALITY = 0.5;
const MAX_CANVAS_WIDTH = 992;
const IMAGE_MAX_EDGE = 880;

export async function downloadVehicleHandoverPdfFromDom({ filename }) {
    const root = document.getElementById(CAPTURE_ROOT_ID);
    if (!root) {
        throw new Error('Handover form preview is not ready yet.');
    }

    const pageNodes = Array.from(root.querySelectorAll(`.${PDF_PAGE_SURFACE_CLASS}`));
    const targets = pageNodes.length ? pageNodes : [root];

    await compressImagesInElement(root, {
        maxEdge: IMAGE_MAX_EDGE,
        quality: JPEG_QUALITY,
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < targets.length; index += 1) {
        const pageEl = targets[index];
        const captureId = `vehicle-handover-pdf-page-${index}`;
        pageEl.setAttribute('id', captureId);

        const canvas = await html2canvas(
            pageEl,
            buildHtml2CanvasOptions({
                rootElementId: captureId,
                scale: CAPTURE_SCALE,
                backgroundColor: '#ffffff',
            }),
        );

        pageEl.removeAttribute('id');

        const imgData = canvasToCompressedJpeg(canvas, {
            maxWidth: MAX_CANVAS_WIDTH,
            quality: JPEG_QUALITY,
        });
        if (index > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }

    pdf.save(filename);
}
