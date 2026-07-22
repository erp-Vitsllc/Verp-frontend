'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ChevronDown,
    Download,
    Loader2,
    Mail,
    MoreHorizontal,
    Pencil,
    Printer,
} from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ErpErrorBanner from '@/components/ErpErrorBanner';

function cleanText(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

/** Hide Chrome/Edge built-in PDF chrome when possible. */
function pdfViewerSrc(blobUrl) {
    if (!blobUrl) return '';
    return `${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
}

/**
 * Payment detail: official Zoho PDF in the main pane (+ Download / Edit).
 * variant="page"  → full page with back button
 * variant="panel" → embedded in split-pane
 */
export default function ViewVendorPaymentDetail({
    paymentId,
    organizationId = '',
    onClose,
    variant = 'page',
    listPreview = null,
}) {
    const isPanel = variant === 'panel';
    const router = useRouter();
    const { toast } = useToast();
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sourceHint, setSourceHint] = useState('');
    const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');
    const [pdfError, setPdfError] = useState('');
    const pdfMenuRef = useRef(null);
    const pdfRequestIdRef = useRef(0);
    const orgId = String(organizationId || '').trim();
    // Stable identity — a fresh object every render would retrigger loadPayment's effect forever.
    const orgParams = useMemo(
        () => (orgId ? { organizationId: orgId } : undefined),
        [orgId],
    );

    const revokePdfUrl = useCallback((url) => {
        if (url) URL.revokeObjectURL(url);
    }, []);

    const fetchPaymentPdfBlob = useCallback(async () => {
        const id = String(paymentId || '').trim();
        if (!id) throw new Error('Payment id is missing.');

        try {
            const response = await axiosInstance.get(
                `/zoho/vendorpayments/${encodeURIComponent(id)}/pdf`,
                {
                    responseType: 'blob',
                    skipToast: true,
                    timeout: 90000,
                    params: orgParams,
                },
            );

            const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                let message = 'Failed to download PDF from Zoho.';
                try {
                    message = JSON.parse(text)?.message || message;
                } catch {
                    /* keep default */
                }
                throw new Error(message);
            }

            const disposition = String(response.headers?.['content-disposition'] || '');
            const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
            const name = match?.[1]
                ? decodeURIComponent(match[1].replace(/"/g, ''))
                : `Payment-${id}.pdf`;

            const blob =
                response.data instanceof Blob
                    ? response.data
                    : new Blob([response.data], { type: 'application/pdf' });

            return { blob, name };
        } catch (err) {
            if (err?.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const parsed = JSON.parse(text);
                    if (parsed?.message) {
                        throw new Error(parsed.message);
                    }
                } catch (inner) {
                    if (inner?.message && !inner?.response) throw inner;
                }
            }
            throw err;
        }
    }, [orgParams, paymentId]);

    const loadZohoPdf = useCallback(async () => {
        const requestId = ++pdfRequestIdRef.current;
        setPdfLoading(true);
        setPdfError('');

        try {
            const { blob, name } = await fetchPaymentPdfBlob();
            if (requestId !== pdfRequestIdRef.current) {
                return { ok: false, cancelled: true };
            }
            const url = URL.createObjectURL(blob);
            setPdfUrl((prev) => {
                revokePdfUrl(prev);
                return url;
            });
            setPdfFileName(name);
            return { ok: true };
        } catch (err) {
            if (requestId !== pdfRequestIdRef.current) {
                return { ok: false, cancelled: true };
            }
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Zoho PDF is not available for this payment.';
            setPdfError(message);
            setPdfUrl((prev) => {
                revokePdfUrl(prev);
                return '';
            });
            setPdfFileName('');
            return { ok: false, message };
        } finally {
            if (requestId === pdfRequestIdRef.current) {
                setPdfLoading(false);
            }
        }
    }, [fetchPaymentPdfBlob, revokePdfUrl]);

    const loadPayment = useCallback(async () => {
        const id = String(paymentId || '').trim();
        if (!id) {
            setError('Payment id is missing.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        setSourceHint('');
        setPdfError('');
        setPdfMenuOpen(false);
        pdfRequestIdRef.current += 1;
        setPdfUrl((prev) => {
            revokePdfUrl(prev);
            return '';
        });
        setPdfFileName('');

        try {
            const response = await axiosInstance.get(
                `/zoho/vendorpayments/${encodeURIComponent(id)}`,
                { skipToast: true, timeout: 60000, params: orgParams },
            );
            const data = response?.data?.data;
            if (!data) {
                throw new Error('Payment not found.');
            }
            setPayment(data);
            if (response?.data?.meta?.source === 'database') {
                setSourceHint(
                    response?.data?.meta?.syncError
                        ? `Showing local copy (${response.data.meta.syncError})`
                        : 'Showing local copy from database',
                );
            }
            setLoading(false);
            void loadZohoPdf();
        } catch (err) {
            setPayment(null);
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load payment details.',
            );
            setLoading(false);
        }
    }, [loadZohoPdf, orgParams, paymentId, revokePdfUrl]);

    useEffect(() => {
        void loadPayment();
    }, [loadPayment]);

    useEffect(() => {
        return () => {
            revokePdfUrl(pdfUrl);
        };
    }, [pdfUrl, revokePdfUrl]);

    useEffect(() => {
        if (!pdfMenuOpen) return undefined;
        const onDocClick = (event) => {
            if (!pdfMenuRef.current?.contains(event.target)) {
                setPdfMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [pdfMenuOpen]);

    const handleDownloadPdf = useCallback(async () => {
        setPdfMenuOpen(false);
        setPdfLoading(true);
        try {
            let blob;
            let name;
            if (pdfUrl) {
                const response = await fetch(pdfUrl);
                blob = await response.blob();
                name = pdfFileName || `Payment-${paymentId}.pdf`;
            } else {
                ({ blob, name } = await fetchPaymentPdfBlob());
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast({
                title: 'PDF downloaded',
                description: name,
            });
        } catch (err) {
            toast({
                title: 'PDF download failed',
                description:
                    err?.response?.data?.message ||
                    err?.message ||
                    'Zoho PDF is not available for this payment.',
                variant: 'destructive',
            });
        } finally {
            setPdfLoading(false);
        }
    }, [fetchPaymentPdfBlob, paymentId, pdfFileName, pdfUrl, toast]);

    const handlePrint = useCallback(() => {
        setPdfMenuOpen(false);
        if (pdfUrl) {
            const win = window.open(pdfViewerSrc(pdfUrl), '_blank');
            if (win) {
                win.addEventListener('load', () => {
                    try {
                        win.focus();
                        win.print();
                    } catch {
                        /* ignore */
                    }
                });
                return;
            }
        }
        window.print();
    }, [pdfUrl]);

    const handleEdit = useCallback(() => {
        const id = String(paymentId || '').trim();
        if (!id) return;
        router.push(
            `/Accounts/PaymentsMade/${encodeURIComponent(id)}/edit${
                orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ''
            }`,
        );
    }, [paymentId, router]);

    const paymentNumber = cleanText(
        payment?.payment_number ||
            payment?.payment_no ||
            payment?.payment_id ||
            listPreview?.paymentNumber,
    );
    const location = cleanText(
        payment?.location_name ||
            payment?.branch_name ||
            payment?.place_of_supply ||
            listPreview?.location,
        '',
    );

    const toolbar = (
        <div
            className={`flex flex-wrap items-center justify-between gap-3 print:hidden ${
                isPanel
                    ? 'shrink-0 border-b border-slate-200 bg-white px-4 py-3'
                    : 'border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3'
            }`}
        >
            <div className="flex flex-wrap items-center gap-2">
                {!isPanel && onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </button>
                ) : null}
                {isPanel && onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        <ArrowLeft size={14} />
                        Back to list
                    </button>
                ) : null}
                <button
                    type="button"
                    disabled={loading || !payment}
                    onClick={handleEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <Pencil size={13} />
                    Edit
                </button>
                <button
                    type="button"
                    disabled
                    title="Email from ERP is not available yet"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400"
                >
                    <Mail size={13} />
                    Send Email
                </button>

                <div className="relative" ref={pdfMenuRef}>
                    <button
                        type="button"
                        disabled={pdfLoading || loading || !payment}
                        onClick={() => setPdfMenuOpen((open) => !open)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        {pdfLoading ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : (
                            <Printer size={13} />
                        )}
                        PDF / Print
                        <ChevronDown size={12} className="opacity-50" />
                    </button>
                    {pdfMenuOpen ? (
                        <div className="absolute left-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                                type="button"
                                onClick={() => void handleDownloadPdf()}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <Download size={14} className="text-slate-500" />
                                Download PDF
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <Printer size={14} className="text-slate-500" />
                                Print
                            </button>
                            {pdfError ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPdfMenuOpen(false);
                                        void loadZohoPdf();
                                    }}
                                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Retry Zoho PDF
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                    aria-label="More actions"
                    disabled
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>
            <div className="flex items-center gap-3 text-right">
                <div>
                    <p className="text-lg font-bold tabular-nums text-slate-800 leading-none">
                        {paymentNumber !== '—' ? paymentNumber : '…'}
                    </p>
                    {location ? (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                            Location: {location}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );

    const body = (
        <div
            className={`${isPanel ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f4f6f8] p-4 sm:p-6' : 'p-4 sm:p-6 bg-[#f4f6f8]'}`}
        >
            {error ? (
                <div className="mb-4 space-y-3 print:hidden">
                    <ErpErrorBanner message={error} />
                    <button
                        type="button"
                        onClick={() => void loadPayment()}
                        className="text-xs sm:text-sm font-semibold text-teal-700 underline"
                    >
                        Try again
                    </button>
                </div>
            ) : null}

            {sourceHint ? (
                <p className="mb-3 text-xs text-amber-700 print:hidden">{sourceHint}</p>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    Loading payment…
                </div>
            ) : null}

            {!loading && payment && pdfLoading && !pdfUrl ? (
                <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
                    <Loader2 size={18} className="animate-spin" />
                    Loading Zoho PDF…
                </div>
            ) : null}

            {!loading && payment && pdfUrl ? (
                <div className="mx-auto flex h-[min(78vh,900px)] max-w-5xl flex-col overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
                    <iframe
                        title={pdfFileName || 'Zoho Payment PDF'}
                        src={pdfViewerSrc(pdfUrl)}
                        className="h-full w-full flex-1 border-0"
                    />
                </div>
            ) : null}

            {!loading && payment && !pdfLoading && !pdfUrl && pdfError ? (
                <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-amber-800">Could not load Zoho PDF</p>
                    <p className="mt-1 text-xs text-amber-700">{pdfError}</p>
                    <button
                        type="button"
                        onClick={() => void loadZohoPdf()}
                        className="mt-3 text-xs font-semibold text-teal-700 underline"
                    >
                        Retry PDF
                    </button>
                </div>
            ) : null}

            {!loading && !payment && !error ? (
                <div className="py-16 text-center text-sm text-slate-500">
                    Payment not found.
                </div>
            ) : null}
        </div>
    );

    if (isPanel) {
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
                {toolbar}
                {body}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {toolbar}
            {body}
        </div>
    );
}
