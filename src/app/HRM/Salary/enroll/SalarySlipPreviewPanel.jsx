'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';

function previousMonthKey() {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function messageFromBlobError(err) {
    const data = err?.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message) return parsed.message;
        } catch {
            /* keep default */
        }
    }
    if (typeof data?.message === 'string' && data.message) return data.message;
    return 'Could not load salary slip for this employee.';
}

export default function SalarySlipPreviewPanel({ employeeId }) {
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const blobRef = useRef(null);

    useEffect(() => {
        if (!employeeId) return undefined;
        let cancelled = false;
        let objectUrl = '';
        const monthKey = previousMonthKey();

        async function loadSlip() {
            setLoading(true);
            setError('');
            setPdfUrl('');
            blobRef.current = null;
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/salary-slip`,
                    {
                        params: { month: monthKey },
                        responseType: 'blob',
                        skipToast: true,
                    },
                );
                const blob = new Blob([res.data], { type: 'application/pdf' });
                objectUrl = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                blobRef.current = blob;
                setPdfUrl(objectUrl);
            } catch (err) {
                if (!cancelled) setError(await messageFromBlobError(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadSlip();
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [employeeId]);

    function downloadPdf() {
        const blob = blobRef.current;
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Salary-Slip-${employeeId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="mb-3 flex justify-end">
                <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={!blobRef.current && !pdfUrl}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                    <Download size={15} />
                    Download PDF
                </button>
            </div>
            {loading ? (
                <div className="flex min-h-[560px] items-center justify-center rounded-lg bg-[#F8FAFC]">
                    <Loader2 className="animate-spin text-blue-600" size={28} />
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-6 text-sm text-red-600">
                    {error}
                </div>
            ) : pdfUrl ? (
                <iframe
                    title={`Salary slip ${employeeId}`}
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="h-[calc(100vh-240px)] min-h-[720px] w-full rounded-lg bg-white"
                />
            ) : null}
        </section>
    );
}
