'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import NavButton from '@/components/NavButton';
import {
    SALARY_EARNING_CATALOG,
    applySlipSectionPatch,
    formatAed,
    money,
    pickComponent,
    salarySlipErrorMessage,
    salarySlipMonthLabel,
} from './salarySlipEdit';
import SalarySlipCards from './SalarySlipCards';

function amountOf(slip, name) {
    const yearly = money(pickComponent(slip?.yearlyEarnings, name).amount);
    if (yearly > 0) return yearly;
    return money(pickComponent(slip?.earnings, name).amount);
}

function slipHeaderAmounts(slip) {
    const monthlySalary = SALARY_EARNING_CATALOG.reduce((sum, name) => sum + amountOf(slip, name), 0);
    const basicSalary = amountOf(slip, 'Basic Salary');
    return {
        monthlySalary: money(monthlySalary),
        basicSalary: money(basicSalary),
        otherSalary: money(Math.max(0, monthlySalary - basicSalary)),
    };
}

const GHOST_BTN =
    'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] font-semibold text-[#334155] no-underline disabled:opacity-50';
const PRIMARY_BTN =
    'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-2 text-[13px] font-semibold text-white disabled:opacity-50';
const PAIR_BTN =
    'inline-flex h-10 min-w-0 w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-center text-[12px] font-semibold leading-tight text-[#334155] no-underline disabled:opacity-50';

export default function SalarySlipMonthView({ employeeId, monthKey }) {
    const { toast } = useToast();
    const [slip, setSlip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [showPdf, setShowPdf] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const blobRef = useRef(null);
    const urlRef = useRef('');

    useEffect(() => {
        if (!employeeId || !monthKey) {
            setLoading(false);
            setError('Salary slip month is required.');
            return undefined;
        }
        let cancelled = false;
        async function loadSlip() {
            setLoading(true);
            setError('');
            setDirty(false);
            setShowPdf(false);
            try {
                const res = await axiosInstance.get(
                    `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/salary-slip`,
                    { params: { month: monthKey, format: 'json' }, skipToast: true },
                );
                if (!cancelled) setSlip(res.data?.slip || null);
            } catch (err) {
                if (!cancelled) {
                    setSlip(null);
                    setError(await salarySlipErrorMessage(err));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadSlip();
        return () => {
            cancelled = true;
        };
    }, [employeeId, monthKey]);

    useEffect(() => {
        return () => {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
    }, []);

    function clearPdfCache() {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = '';
        blobRef.current = null;
        setPdfUrl('');
        setShowPdf(false);
    }

    function patchSlip(section, updater) {
        setSlip((current) => {
            if (!current) return current;
            return applySlipSectionPatch(current, section, updater);
        });
        setDirty(true);
    }

    async function saveMonth() {
        if (!employeeId || !monthKey || !slip || saving) return;
        setSaving(true);
        try {
            const res = await axiosInstance.put(
                `/Employee/salary-enroll/${encodeURIComponent(employeeId)}/historical/salary-slip`,
                { monthKey, slip },
            );
            setSlip(res.data?.slip || slip);
            setDirty(false);
            clearPdfCache();
            toast({ title: res.data?.message || 'Salary slip updated.' });
        } catch (err) {
            toast({
                title: err?.response?.data?.message || 'Could not update salary slip',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    async function ensurePdf() {
        if (!employeeId || !monthKey) return '';
        if (urlRef.current) {
            setPdfUrl(urlRef.current);
            return urlRef.current;
        }
        setPdfLoading(true);
        setError('');
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
            const objectUrl = URL.createObjectURL(blob);
            blobRef.current = blob;
            urlRef.current = objectUrl;
            setPdfUrl(objectUrl);
            return objectUrl;
        } catch (err) {
            setError(await salarySlipErrorMessage(err));
            return '';
        } finally {
            setPdfLoading(false);
        }
    }

    async function viewAttachment() {
        const url = await ensurePdf();
        if (!url) return;
        setShowPdf(true);
    }

    function downloadPdf() {
        const blob = blobRef.current;
        const existing = urlRef.current;
        if (!blob && !existing) return;
        const url = blob ? URL.createObjectURL(blob) : existing;
        const link = document.createElement('a');
        link.href = url;
        link.download = `Salary-Slip-${monthKey}-${employeeId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        if (blob) URL.revokeObjectURL(url);
    }

    const monthLabel = salarySlipMonthLabel(monthKey);
    const amounts = slipHeaderAmounts(slip);
    const displayName = slip?.employeeName || '—';
    const displayId = slip?.employeeId || employeeId || '—';
    const slipReturnHref = employeeId && monthKey
        ? `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}/salary-slip/${encodeURIComponent(monthKey)}`
        : '/HRM/Salary';
    const historyHref = employeeId ? `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}` : '';

    return (
        <div className="w-full max-w-full p-4 sm:p-6 lg:p-8">
            <div className="mb-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm sm:px-6">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(14rem,0.9fr)] lg:gap-0">
                    <div className="min-w-0 lg:pr-6">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                                {displayName}
                            </h1>
                            <span className="text-sm font-medium text-slate-500">
                                {monthLabel || '—'}
                            </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{displayId}</p>
                    </div>

                    <div className="min-w-0 lg:border-l lg:border-gray-100 lg:px-6">
                        <h2 className="mb-3 text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[22px]">
                            Salary slip
                        </h2>
                        <div className="space-y-1.5 text-sm">
                            <p>
                                <span className="text-slate-500">Monthly salary = </span>
                                <span className="font-semibold tabular-nums text-slate-900">
                                    {formatAed(amounts.monthlySalary)}
                                </span>
                            </p>
                            <p>
                                <span className="text-slate-500">Basic salary = </span>
                                <span className="font-semibold tabular-nums text-slate-900">
                                    {formatAed(amounts.basicSalary)}
                                </span>
                            </p>
                            <p>
                                <span className="text-slate-500">Other salary = </span>
                                <span className="font-semibold tabular-nums text-slate-900">
                                    {formatAed(amounts.otherSalary)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 lg:border-l lg:border-gray-100 lg:pl-6">
                        <button
                            type="button"
                            onClick={viewAttachment}
                            disabled={pdfLoading || loading || !slip}
                            className={GHOST_BTN}
                        >
                            {pdfLoading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                            View attachment
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                await ensurePdf();
                                downloadPdf();
                            }}
                            disabled={loading || !slip}
                            className={GHOST_BTN}
                        >
                            <Download size={15} />
                            Download PDF
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <NavButton
                                href={historyHref}
                                listReturnHref={slipReturnHref}
                                enabled={Boolean(historyHref)}
                                className={PAIR_BTN}
                            >
                                Salary history
                            </NavButton>
                            <button
                                type="button"
                                onClick={saveMonth}
                                disabled={!slip || saving || !dirty}
                                className={PRIMARY_BTN}
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-[12px] border border-[#E6EAF0] bg-white">
                    <Loader2 className="animate-spin text-blue-600" size={28} />
                </div>
            ) : error && !slip ? (
                <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-6 text-sm text-red-600">
                    {error}
                </div>
            ) : slip ? (
                <div className="space-y-4">
                    {error ? (
                        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    ) : null}
                    <SalarySlipCards slip={slip} onPatch={patchSlip} />
                    {showPdf && pdfUrl ? (
                        <iframe
                            title={`Salary slip ${employeeId} ${monthKey}`}
                            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="h-[calc(100vh-220px)] min-h-[640px] w-full rounded-[12px] border border-[#E6EAF0] bg-white"
                        />
                    ) : null}
                </div>
            ) : (
                <div className="rounded-[12px] border border-[#E6EAF0] bg-white px-4 py-10 text-center text-sm text-[#64748B]">
                    No salary slip found for this month.
                </div>
            )}
        </div>
    );
}
