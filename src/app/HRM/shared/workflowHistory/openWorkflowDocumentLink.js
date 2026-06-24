import axiosInstance from '@/utils/axios';

function openPdfBlob(blob, fileName = 'document.pdf') {
    const pdfBlob = blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(pdfBlob);
    const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
}

/**
 * Open workflow history PDFs through the API (avoids expired Wasabi presigned URLs).
 */
export async function openWorkflowDocumentLink(link, { entityKind, entityRouteId } = {}) {
    if (!link) return;

    const { publicId, source, url, label } = link;

    try {
        if (publicId) {
            const response = await axiosInstance.get('/storage/file', {
                params: { key: publicId },
                responseType: 'blob',
            });
            openPdfBlob(response.data, label || 'document.pdf');
            return;
        }

        if (entityKind === 'fine' && entityRouteId) {
            const response = await axiosInstance.get(
                `/Fine/${encodeURIComponent(entityRouteId)}/approved-report-pdf`,
                { responseType: 'blob' },
            );
            openPdfBlob(response.data, label || 'fine-report.pdf');
            return;
        }

        if (entityKind === 'loan' && entityRouteId) {
            const response = await axiosInstance.get(
                `/Employee/loans/${encodeURIComponent(entityRouteId)}/acknowledgment-pdf`,
                { responseType: 'blob' },
            );
            openPdfBlob(response.data, label || 'loan-acknowledgment.pdf');
            return;
        }

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        if (source === 'asset-loss-report' || source === 'approved-form' || source === 'acknowledgment') {
            throw new Error('Document reference missing');
        }
    } catch (error) {
        console.error('[openWorkflowDocumentLink]', error);
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }
}
