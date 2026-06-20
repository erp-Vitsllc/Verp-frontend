'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { loadPdfJs } from '@/app/emp/[employeeId]/utils/lazyLibraries';
import { format } from 'date-fns';

function formatApprovalDate(value) {
    if (!value) return null;
    try {
        return format(new Date(value), 'dd MMM yyyy, h:mm a');
    } catch {
        return null;
    }
}

async function renderPdfPageImages(blob) {
    const pdfjs = await loadPdfJs();
    if (typeof window !== 'undefined') {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const data = await blob.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const images = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;
        images.push(canvas.toDataURL('image/png'));
    }

    return images;
}

export default function FineApprovedAttachmentsTab({
    fine,
    fineRouteId,
    employeeId,
}) {
    const { toast } = useToast();
    const [pageImages, setPageImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const pdfBlobRef = useRef(null);

    const downloadFileName = `AssetLossFineReport-${fine?.fineId || fineRouteId || 'fine'}.pdf`;

    useEffect(() => {
        let cancelled = false;

        const loadApprovedForm = async () => {
            setLoading(true);
            setError('');
            setPageImages([]);
            pdfBlobRef.current = null;

            try {
                const targetId = fineRouteId || fine?._id || fine?.fineId;
                const params = employeeId ? { employeeId } : undefined;
                const response = await axiosInstance.get(
                    `/Fine/${encodeURIComponent(targetId)}/approved-report-pdf`,
                    { responseType: 'blob', params },
                );
                if (cancelled) return;

                const blob = new Blob([response.data], { type: 'application/pdf' });
                pdfBlobRef.current = blob;
                const images = await renderPdfPageImages(blob);
                if (cancelled) return;

                setPageImages(images);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load approved fine form:', err);
                setError('Could not load the approved fine form. Please refresh and try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadApprovedForm();

        return () => {
            cancelled = true;
        };
    }, [fine?._id, fine?.fineId, fineRouteId, employeeId]);

    const handleDownload = async () => {
        try {
            setDownloading(true);
            let blob = pdfBlobRef.current;

            if (!blob) {
                const targetId = fineRouteId || fine?._id || fine?.fineId;
                const params = employeeId ? { employeeId } : undefined;
                const response = await axiosInstance.get(
                    `/Fine/${encodeURIComponent(targetId)}/approved-report-pdf`,
                    { responseType: 'blob', params },
                );
                blob = new Blob([response.data], { type: 'application/pdf' });
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', downloadFileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
                title: 'Download started',
                description: 'Attachment is downloading.',
                variant: 'success',
                className: 'bg-green-50 border-green-200 text-green-800',
            });
        } catch (err) {
            console.error('Attachment download failed:', err);
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description: 'Could not download the attachment.',
            });
        } finally {
            setDownloading(false);
        }
    };

    const approvedOn = formatApprovalDate(fine?.approvedDate);

    return (
        <div className="w-full mb-8 print:hidden">
            <div className="bg-white rounded-xl overflow-hidden flex flex-col">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-blue-600 shrink-0" />
                        <p className="text-[11px] font-semibold text-slate-600">
                            {approvedOn ? `Approved on ${approvedOn}` : 'Attachment'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={loading || downloading || !!error}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {downloading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Download size={16} />
                        )}
                        Download
                    </button>
                </div>

                <div className="flex-1 p-8 bg-slate-100/30 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {error ? (
                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-500">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    ) : loading ? (
                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-500">
                            <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
                            <p className="text-sm font-medium text-slate-600">Loading attachment…</p>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-full max-w-[210mm] flex flex-col items-center">
                                {pageImages.map((src, index) => (
                                    <img
                                        key={`page-${index}`}
                                        src={src}
                                        alt={`Attachment page ${index + 1}`}
                                        className="w-full h-auto bg-white block"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
