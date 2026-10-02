'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

function formatApprovalDate(value) {
    if (!value) return null;
    try {
        return format(new Date(value), 'dd MMM yyyy, h:mm a');
    } catch {
        return null;
    }
}

function storedAcknowledgmentKey(loan) {
    const list = Array.isArray(loan?.approvalAttachments) ? loan.approvalAttachments : [];
    const matches = list.filter((item) => item?.source === 'acknowledgment' && item?.publicId);
    return matches.length ? String(matches[matches.length - 1].publicId) : '';
}

async function fetchPdfBlob(url, config) {
    const response = await axiosInstance.get(url, { responseType: 'blob', ...config });
    const contentType = String(response.headers?.['content-type'] || '');
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
        throw new Error('Server returned an error instead of a PDF');
    }
    const blob = new Blob([response.data], { type: 'application/pdf' });
    if (blob.size < 500) throw new Error('PDF was empty');
    return blob;
}

export default function LoanApprovedAttachmentsTab({ loan, loanRouteId }) {
    const { toast } = useToast();
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const pdfBlobRef = useRef(null);
    const objectUrlRef = useRef('');

    const typeSlug = loan?.type === 'Advance' ? 'Advance' : 'Loan';
    const downloadFileName = `${typeSlug}_Acknowledgment_${loan?.loanId || loanRouteId || 'request'}.pdf`;
    const storedKey = useMemo(() => storedAcknowledgmentKey(loan), [loan?.approvalAttachments]);

    useEffect(() => {
        let cancelled = false;

        const loadAcknowledgment = async () => {
            setLoading(true);
            setError('');
            pdfBlobRef.current = null;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = '';
            }
            setPdfUrl('');

            try {
                const targetId = loanRouteId || loan?.id || loan?._id;
                let blob = null;

                if (storedKey) {
                    try {
                        blob = await fetchPdfBlob('/storage/file', { params: { key: storedKey } });
                    } catch (storageErr) {
                        console.warn('Stored acknowledgment unavailable, loading PDF endpoint:', storageErr);
                    }
                }

                if (!blob) {
                    blob = await fetchPdfBlob(`/Employee/loans/${targetId}/acknowledgment-pdf`);
                }
                if (cancelled) return;

                pdfBlobRef.current = blob;
                const objectUrl = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                objectUrlRef.current = objectUrl;
                setPdfUrl(objectUrl);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load loan acknowledgment PDF:', err);
                setError('Could not load the acknowledgment document. Please refresh and try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadAcknowledgment();

        return () => {
            cancelled = true;
        };
    }, [loan?.id, loan?._id, loan?.loanId, loanRouteId, storedKey]);

    useEffect(() => () => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    }, []);

    const handleDownload = async () => {
        try {
            setDownloading(true);
            let blob = pdfBlobRef.current;

            if (!blob) {
                const targetId = loanRouteId || loan?.id || loan?._id;
                const response = await axiosInstance.get(`/Employee/loans/${targetId}/acknowledgment-pdf`, {
                    responseType: 'blob',
                });
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
                description: 'Acknowledgment PDF is downloading.',
                className: 'bg-green-50 border-green-200 text-green-800',
            });
        } catch (err) {
            console.error('Acknowledgment download failed:', err);
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description: 'Could not download the acknowledgment PDF.',
            });
        } finally {
            setDownloading(false);
        }
    };

    const approvedOn = formatApprovalDate(loan?.approvedDate);

    return (
        <div className="w-full mb-8 print:hidden">
            <div className="bg-white rounded-xl overflow-hidden flex flex-col">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-blue-600 shrink-0" />
                        <p className="text-[11px] font-semibold text-slate-600">
                            {typeSlug} Acknowledgment &amp; Salary Deduction Authorization
                            {approvedOn ? ` — Approved on ${approvedOn}` : ''}
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
                            <p className="text-sm font-medium text-slate-600">Loading acknowledgment…</p>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <iframe
                                title={`${typeSlug} acknowledgment`}
                                src={pdfUrl}
                                className="w-full max-w-[210mm] h-[680px] bg-white shadow-sm border-0"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
