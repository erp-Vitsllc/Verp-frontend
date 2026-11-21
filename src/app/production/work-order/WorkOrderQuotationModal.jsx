'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';

const FOCUS = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

function pdfViewerSrc(blobUrl) {
    if (!blobUrl) return '';
    return `${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
}

async function readBlobMessage(data, fallback) {
    if (!(data instanceof Blob)) return fallback;
    try {
        const parsed = JSON.parse(await data.text());
        return parsed?.message || fallback;
    } catch {
        return fallback;
    }
}

async function loadQuotationPdf({ quotationRef, quotationId }) {
    const params = {};
    if (quotationId) params.estimateId = quotationId;
    if (quotationRef) params.number = quotationRef;
    try {
        const response = await axiosInstance.get('/zoho/estimates/pdf', {
            params,
            responseType: 'blob',
            skipToast: true,
            timeout: 90000,
        });
        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        if (contentType.includes('application/json')) {
            throw new Error(await readBlobMessage(response.data, 'Could not open this quotation.'));
        }
        const disposition = String(response.headers?.['content-disposition'] || '');
        const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
        const name = match?.[1]
            ? decodeURIComponent(match[1].replace(/"/g, '').trim())
            : `Quotation-${quotationRef || 'document'}.pdf`;
        const blob = response.data instanceof Blob
            ? response.data
            : new Blob([response.data], { type: 'application/pdf' });
        return { blob, name };
    } catch (error) {
        const fromBlob = await readBlobMessage(
            error?.response?.data,
            error?.response?.data?.message || error?.message || 'Could not open this quotation.',
        );
        throw new Error(fromBlob);
    }
}

export default function WorkOrderQuotationModal({ quotationRef, quotationId, onClose }) {
    const [pdfUrl, setPdfUrl] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { blob, name } = await loadQuotationPdf({ quotationRef, quotationId });
            const url = URL.createObjectURL(blob);
            setPdfUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return url;
            });
            setFileName(name);
        } catch (loadError) {
            setPdfUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return '';
            });
            setFileName('');
            setError(loadError?.message || 'Could not open this quotation.');
        } finally {
            setLoading(false);
        }
    }, [quotationId, quotationRef]);

    useEffect(() => {
        load();
        return () => {
            setPdfUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return '';
            });
        };
    }, [load]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const download = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = fileName || `Quotation-${quotationRef || 'document'}.pdf`;
        link.click();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Quotation ${quotationRef || ''}`}
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between gap-3 border-b border-[#e6eef6] bg-white px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f1ff] text-[#2f6fed]">
                            <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">Quotation</p>
                            <p className="truncate text-[12px] text-slate-500">{quotationRef || 'Zoho quotation'}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={download}
                            disabled={!pdfUrl || loading}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2f6fed] px-3 text-[13px] font-semibold text-white hover:bg-[#245fe0] disabled:opacity-50 ${FOCUS}`}
                        >
                            <Download size={15} />
                            Download
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close quotation"
                            className={`flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 bg-[#f3f7fb] p-3 sm:p-4">
                    {loading ? (
                        <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 size={18} className="animate-spin" />
                            Opening quotation…
                        </div>
                    ) : null}
                    {!loading && error ? (
                        <div className="mx-auto flex h-[40vh] max-w-lg flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-center">
                            <p className="text-sm font-semibold text-amber-900">Could not open this quotation</p>
                            <p className="mt-1 text-[13px] text-amber-800">{error}</p>
                            <button
                                type="button"
                                onClick={load}
                                className={`mt-3 text-[13px] font-semibold text-[#2f6fed] hover:underline ${FOCUS}`}
                            >
                                Try again
                            </button>
                        </div>
                    ) : null}
                    {!loading && pdfUrl ? (
                        <iframe
                            title={fileName || `Quotation ${quotationRef || ''}`}
                            src={pdfViewerSrc(pdfUrl)}
                            className="h-[min(78vh,860px)] w-full rounded-xl border border-[#e6eef6] bg-white"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
