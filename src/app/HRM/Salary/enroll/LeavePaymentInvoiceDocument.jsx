'use client';

import { useRef, useState } from 'react';
import { Download, FileText, Loader2, X } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

function money(value, currency = 'AED') {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n : 0;
    return `${currency} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function invoiceDate(value) {
    if (!value) return '—';
    const parsed = /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? parseISO(String(value).slice(0, 10)) : new Date(value);
    if (!isValid(parsed)) return String(value);
    return format(parsed, 'd MMMM yyyy');
}

function invoiceFileName(invoice) {
    const raw = String(invoice?.invoiceNo || 'payment-invoice')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `${raw || 'payment-invoice'}.pdf`;
}

async function downloadInvoicePdf(element, fileName) {
    if (!element) return;
    const [{ default: html2canvas }, { buildHtml2CanvasOptions }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('@/utils/html2canvasSafeCapture'),
        import('jspdf'),
    ]);
    const canvas = await html2canvas(
        element,
        buildHtml2CanvasOptions({
            backgroundColor: '#ffffff',
            scale: 2,
        }),
    );
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 8) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }
    pdf.save(fileName);
}

function PaymentInvoicePaper({ invoice }) {
    const currency = invoice.currency || 'AED';
    const lines = Array.isArray(invoice.lines) ? invoice.lines : [];
    const paidAmount = Number(invoice.paidAmount) || 0;
    const remaining = lines.reduce((sum, line) => sum + (Number(line.balanceAfter) || 0), 0);
    const paidEarlier = lines.reduce((sum, line) => sum + (Number(line.paidBefore) || 0), 0);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl max-w-4xl mx-auto p-8 sm:p-10">
            <div className="flex justify-between items-start mb-8 border-b-2 border-blue-600 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-blue-700 tracking-tighter">INVOICE</h1>
                    <p className="text-sm text-gray-400 mt-1 font-medium">
                        Reference:{' '}
                        <span className="text-gray-900 font-bold">{invoice.invoiceNo}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{invoice.title}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black text-gray-800 tracking-tighter">VERP</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Payment confirmation
                    </p>
                    <p className="text-xs text-gray-500 mt-2">SL No {invoice.slNo}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-10">
                <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Bill to</h3>
                    <p className="text-lg font-bold text-gray-900">{invoice.employeeName}</p>
                    <p className="text-sm text-gray-500 mt-1">
                        Employee ID:{' '}
                        <span className="font-semibold text-gray-700">{invoice.employeeId}</span>
                    </p>
                    {invoice.companyName ? (
                        <p className="text-sm text-gray-500 mt-1">{invoice.companyName}</p>
                    ) : null}
                    {invoice.designation ? (
                        <p className="text-sm text-gray-500 mt-0.5">{invoice.designation}</p>
                    ) : null}
                    {invoice.department ? (
                        <p className="text-sm text-gray-500 mt-0.5">{invoice.department}</p>
                    ) : null}
                </div>
                <div className="sm:text-right">
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Details</h3>
                    <p className="text-sm text-gray-600">
                        Payment date:{' '}
                        <span className="font-bold text-gray-900">{invoiceDate(invoice.paymentDate)}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        Invoice date: <span className="font-bold text-gray-900">{invoice.issuedOn || '—'}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        Payment mode: <span className="font-bold text-blue-600">{invoice.mode}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        Type: <span className="font-bold text-gray-900">{invoice.kindLabel}</span>
                    </p>
                </div>
            </div>

            <div className="bg-gray-50/50 rounded-xl overflow-hidden border border-gray-100 mb-8">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-4 py-3 text-left">Description</th>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-right">Row total</th>
                            <th className="px-4 py-3 text-right">Balance before</th>
                            <th className="px-4 py-3 text-right">This payment</th>
                            <th className="px-4 py-3 text-right">Balance after</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.length ? (
                            lines.map((line, index) => (
                                <tr key={`${line.label}-${line.entitlementDate}-${index}`} className="border-t border-gray-100">
                                    <td className="px-4 py-4">
                                        <p className="font-bold text-gray-800 text-sm">{line.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Reduced from {invoice.kindLabel?.toLowerCase()} entitlement
                                        </p>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                                        {invoiceDate(line.entitlementDate)}
                                    </td>
                                    <td className="px-4 py-4 text-sm tabular-nums text-right text-gray-700">
                                        {money(line.due, currency)}
                                    </td>
                                    <td className="px-4 py-4 text-sm tabular-nums text-right text-gray-700">
                                        {money(line.balanceBefore, currency)}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-bold tabular-nums text-right text-gray-900">
                                        {money(line.applied, currency)}
                                    </td>
                                    <td className="px-4 py-4 text-sm tabular-nums text-right text-gray-700">
                                        {money(line.balanceAfter, currency)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr className="border-t border-gray-100">
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                    No entitlement reduction recorded for this payment.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end mb-10">
                <div className="w-72 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span>Paid earlier:</span>
                        <span className="text-gray-900">{money(paidEarlier, currency)}</span>
                    </div>
                    <div className="flex justify-between py-4 border-y-2 border-blue-600">
                        <span className="font-black text-gray-800 text-sm">Paid now:</span>
                        <span className="font-black text-blue-700 text-xl">{money(paidAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                        <span className="font-black text-red-500 text-xs">Balance:</span>
                        <span className="font-black text-red-600 text-lg">{money(remaining, currency)}</span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-xl mb-8">
                <p className="text-sm text-blue-900 leading-relaxed">
                    <span className="font-bold italic">Note:</span> {invoice.employeeName} has paid{' '}
                    <span className="font-bold">{money(paidAmount, currency)}</span> as {invoice.title.toLowerCase()}
                    {invoice.mode ? ` via ${invoice.mode}` : ''}. Remaining balance on the reduced row
                    {lines.length === 1 ? '' : 's'} is{' '}
                    <span className="font-bold">{money(remaining, currency)}</span>.
                </p>
                {invoice.remarks ? (
                    <p className="text-sm text-blue-900 mt-3">Remarks: {invoice.remarks}</p>
                ) : null}
            </div>

            <div className="pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                    Generated by VeRP System · Automated information only
                </p>
            </div>
        </div>
    );
}

export default function PaymentInvoiceModal({ open, invoice, onClose }) {
    const paperRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    if (!open || !invoice) return null;

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            await downloadInvoicePdf(paperRef.current, invoiceFileName(invoice));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 print:hidden">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} />
                        Payment Invoice
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100/50">
                    <div ref={paperRef}>
                        <PaymentInvoicePaper invoice={invoice} />
                    </div>
                </div>
                <div className="p-4 sm:p-6 bg-white border-t border-gray-100 flex justify-end gap-2 print:hidden">
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {downloading ? 'Preparing…' : 'Download'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
