'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, Paperclip } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import LoanPaymentReceiptsExpandPanel from '@/app/HRM/LoanAndAdvance/components/LoanPaymentReceiptsDropdown';
import { getFinePaymentsForDocuments } from '@/app/HRM/LoanAndAdvance/utils/loanPaymentReceipts';

function formatApprovalDate(value) {
    if (!value) return null;
    try {
        return format(new Date(value), 'dd MMM yyyy, h:mm a');
    } catch {
        return null;
    }
}

function reportTitleForFine(fine) {
    const type = String(fine?.fineType || '').trim();
    if (!type) return 'FINE REPORT';
    return `${type.toUpperCase()} REPORT`;
}

function reportPdfFileName(fine, fallbackId) {
    const slug = String(fine?.fineType || 'Fine').replace(/[^a-zA-Z0-9]+/g, '') || 'Fine';
    const id = fine?.fineId || fallbackId || 'fine';
    return `${slug}Report-${id}.pdf`;
}

function isImageAttachment(item) {
    const mime = String(item?.mimeType || '').toLowerCase();
    const name = String(item?.name || item?.label || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(name);
}

function collectCorrespondingAttachments(fine, reportName) {
    const list = [];
    const seen = new Set();

    const add = (item, fallbackLabel = '') => {
        if (!item) return;
        const key = String(item.publicId || item.url || item.name || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({
            ...item,
            label: item.label || item.name || fallbackLabel || 'Attachment',
        });
    };

    (fine?.approvalAttachments || []).forEach((item) => {
        const isReport = item?.source === 'approved-form' || item?.source === 'asset-loss-report';
        add(item, isReport ? reportName : 'Supporting Document');
    });
    add(fine?.attachment, 'Supporting Document');
    (fine?.attachments || []).forEach((item, index) => {
        add(item, `Attachment ${index + 1}`);
    });

    return list;
}

function storedReportKey(fine) {
    const list = Array.isArray(fine?.approvalAttachments) ? fine.approvalAttachments : [];
    const matches = list.filter(
        (item) =>
            item?.publicId &&
            (item.source === 'approved-form' || item.source === 'asset-loss-report'),
    );
    return matches.length ? String(matches[matches.length - 1].publicId) : '';
}

async function fetchPdfBlob(url, config) {
    const response = await axiosInstance.get(url, { responseType: 'blob', ...config });
    const contentType = String(response.headers?.['content-type'] || '');
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
        throw new Error('Server returned an error instead of a PDF');
    }
    const blob = new Blob([response.data], { type: 'application/pdf' });
    if (blob.size < 500) throw new Error('Approved PDF was empty');
    return blob;
}

export default function FineApprovedAttachmentsTab({
    fine,
    fineRouteId,
    employeeId,
}) {
    const { toast } = useToast();
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [invoicePayments, setInvoicePayments] = useState([]);
    const pdfBlobRef = useRef(null);
    const objectUrlRef = useRef('');

    const reportTitle = reportTitleForFine(fine);
    const downloadFileName = reportPdfFileName(fine, fineRouteId);
    const correspondingFiles = useMemo(
        () => collectCorrespondingAttachments(fine, downloadFileName),
        [fine, downloadFileName],
    );
    const invoiceReceipts = useMemo(
        () => getFinePaymentsForDocuments(fine, invoicePayments),
        [fine, invoicePayments],
    );
    const storedKey = useMemo(() => storedReportKey(fine), [fine?.approvalAttachments]);

    useEffect(() => {
        let cancelled = false;

        const loadInvoices = async () => {
            if (!fine?.fineId && !fine?._id) {
                setInvoicePayments([]);
                return;
            }
            try {
                const res = await axiosInstance.get('/Payment', {
                    params: {
                        relatedEntityType: 'Fine',
                        ...(fine?.fineId ? { referenceId: fine.fineId } : {}),
                        ...(fine?._id ? { relatedEntityId: fine._id } : {}),
                        ...(employeeId ? { paidBy: employeeId } : {}),
                        limit: 100,
                    },
                });
                if (cancelled) return;
                const pays = res.data?.payments || res.data || [];
                setInvoicePayments(Array.isArray(pays) ? pays : []);
            } catch {
                if (!cancelled) setInvoicePayments([]);
            }
        };

        loadInvoices();
        return () => {
            cancelled = true;
        };
    }, [fine?._id, fine?.fineId, employeeId]);

    useEffect(() => {
        let cancelled = false;

        const loadApprovedForm = async () => {
            setLoading(true);
            setError('');
            pdfBlobRef.current = null;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = '';
            }
            setPdfUrl('');

            try {
                const targetId = fine?._id || fineRouteId || fine?.fineId;
                let blob = null;

                if (storedKey) {
                    try {
                        blob = await fetchPdfBlob('/storage/file', { params: { key: storedKey } });
                    } catch (storageErr) {
                        console.warn('Stored fine report unavailable, loading PDF endpoint:', storageErr);
                    }
                }

                if (!blob) {
                    const params = {
                        ...(employeeId ? { employeeId } : {}),
                    };
                    blob = await fetchPdfBlob(
                        `/Fine/${encodeURIComponent(String(targetId))}/approved-report-pdf`,
                        { params },
                    );
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
    }, [
        fine?._id,
        fine?.fineId,
        fine?.updatedAt,
        fine?.awardedDate,
        fine?.discount,
        fine?.monthStart,
        fine?.description,
        fine?.totalFineAmount,
        fine?.serviceCharge,
        fine?.fineAmount,
        fineRouteId,
        employeeId,
        storedKey,
    ]);

    useEffect(() => () => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    }, []);

    const handleDownload = async () => {
        try {
            setDownloading(true);
            let blob = pdfBlobRef.current;

            if (!blob) {
                const targetId = fine?._id || fineRouteId || fine?.fineId;
                const params = {
                    ...(employeeId ? { employeeId } : {}),
                };
                const response = await axiosInstance.get(
                    `/Fine/${encodeURIComponent(String(targetId))}/approved-report-pdf`,
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
                description: `${downloadFileName} is downloading.`,
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
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold tracking-wide text-slate-800">
                                {reportTitle}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                                {downloadFileName}
                                {approvedOn ? ` · Approved on ${approvedOn}` : ''}
                            </p>
                        </div>
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

                {correspondingFiles.length > 0 && (
                    <div className="px-6 py-3 border-b border-slate-100 bg-white">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Corresponding attachments
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {correspondingFiles.map((item, index) => {
                                const key = item.publicId || item.url || item.name || index;
                                const label = item.label || item.name || `Attachment ${index + 1}`;
                                const isReport =
                                    item.source === 'approved-form' || item.source === 'asset-loss-report';
                                const content = (
                                    <>
                                        {isImageAttachment(item) ? (
                                            <img
                                                src={item.url}
                                                alt=""
                                                className="h-6 w-6 rounded object-cover shrink-0"
                                            />
                                        ) : (
                                            <Paperclip size={14} className="text-slate-400 shrink-0" />
                                        )}
                                        <span className="truncate max-w-[200px]">{label}</span>
                                        {item.url ? <ExternalLink size={12} className="text-slate-400 shrink-0" /> : null}
                                    </>
                                );
                                const className = `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium ${
                                    isReport
                                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                                        : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`;

                                if (item.url) {
                                    return (
                                        <a
                                            key={key}
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${className} hover:opacity-90`}
                                        >
                                            {content}
                                        </a>
                                    );
                                }

                                return (
                                    <span key={key} className={className}>
                                        {content}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1 p-8 bg-slate-100/30 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {error ? (
                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-500">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    ) : loading ? (
                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center text-slate-500">
                            <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
                            <p className="text-sm font-medium text-slate-600">Loading {downloadFileName}…</p>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <iframe
                                title={reportTitle}
                                src={pdfUrl}
                                className="w-full max-w-[210mm] h-[680px] bg-white border-0"
                            />
                        </div>
                    )}
                </div>
            </div>

            {invoiceReceipts.length > 0 ? (
                <div className="mt-4">
                    <LoanPaymentReceiptsExpandPanel
                        receipts={invoiceReceipts}
                        emptyMessage="No payment invoices yet"
                        moduleId="hrm_fine"
                        onViewDocument={(doc) => {
                            if (!doc) return;
                            if (doc.url) {
                                window.open(doc.url, '_blank', 'noopener,noreferrer');
                                return;
                            }
                            if (doc.data && String(doc.data).startsWith('data:')) {
                                window.open(doc.data, '_blank', 'noopener,noreferrer');
                                return;
                            }
                            toast({
                                title: 'Attachment',
                                description: doc.name || 'Attachment is available on this payment.',
                            });
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
