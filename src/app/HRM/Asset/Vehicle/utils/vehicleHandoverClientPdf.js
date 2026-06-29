import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildHtml2CanvasOptions } from '@/utils/html2canvasSafeCapture';
import { PDF_PAGE_SURFACE_CLASS } from './vehicleHandoverFormPdfConstants';

const CAPTURE_ROOT_ID = 'vehicle-handover-form-view';

export async function downloadVehicleHandoverPdfFromDom({ filename }) {
    const root = document.getElementById(CAPTURE_ROOT_ID);
    if (!root) {
        throw new Error('Handover form preview is not ready yet.');
    }

    const pageNodes = Array.from(root.querySelectorAll(`.${PDF_PAGE_SURFACE_CLASS}`));
    const targets = pageNodes.length ? pageNodes : [root];

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
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
                scale: 2,
                backgroundColor: '#ffffff',
            }),
        );

        pageEl.removeAttribute('id');

        const imgData = canvas.toDataURL('image/png');
        if (index > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    }

    pdf.save(filename);
}
