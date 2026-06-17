'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { FineFormSignatureRow, getFineSignatureState } from '@/utils/fineFormSignatures';

const FINE_TYPES = [
    { label: 'Vehicle Fine', catMatch: 'Vehicle' },
    { label: 'Safety Fine', catMatch: 'Safety' },
    { label: 'Project Damage', catMatch: 'Project' },
    { label: 'Loss and Damage', catMatch: 'Loss' },
    { label: 'Other Fine / Damage', catMatch: 'Other' },
];

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
}

export default function FinePrintPage() {
    let { id } = useParams();

    if (id && typeof id === 'string') {
        try {
            id = decodeURIComponent(id);
        } catch (e) {
            console.warn('Could not decode URI component', e);
        }
        if (id.includes(':')) {
            id = id.split(':')[0];
        }
        id = id.trim();
    }

    const [fine, setFine] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                setIsLoading(true);
                setError(null);
                const fineRes = await axiosInstance.get(`/Fine/${id}`);
                setFine(fineRes.data);
            } catch (err) {
                console.error('Error loading print data:', err);
                setError(err.response?.data?.message || err.message || 'Failed to load fine data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const formSummary = fine?.formSummary;
    const isCompanyFine = formSummary?.isCompanyFine || fine?.responsibleFor === 'Company';

    const realEmployee = fine?.assignedEmployees?.find(
        (e) => e.employeeId && e.employeeId !== 'VEGA-HR-0000'
    );
    const employeeName = realEmployee?.employeeName || '-';
    const displayName = isCompanyFine
        ? (fine?.company?.name || 'Company')
        : employeeName;

    const employeeStats = formSummary?.employeeStats || {};
    const hodName = employeeStats.hodName || 'Manager';

    const signatureState = useMemo(() => {
        if (formSummary?.signatures) return formSummary.signatures;
        return getFineSignatureState(fine, { displayName, hodName });
    }, [fine, formSummary, displayName, hodName]);

    const aggregates = formSummary?.aggregates || {};
    const summaries = formSummary || {
        startMonthYear: '-',
        endMonthYear: '-',
        totalFineCount: 0,
        totalAmount: 0,
        paidFineCount: 0,
        paidFineAmount: 0,
        distinctTypesCount: 0,
        outstandingBalance: 0,
        nextSalaryDeduction: 0,
        personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
        salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 },
    };

    const isReady = !isLoading && fine && formSummary;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div id="fine-form-loading" className="text-center p-10 bg-white rounded-lg shadow-sm border">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading Fine Form...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div id="fine-form-error" className="text-center p-10 bg-white rounded-lg shadow-sm border border-red-100 max-w-md">
                    <div className="text-red-500 text-4xl mb-4">!</div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Error Loading Form</h2>
                    <p className="text-red-600 text-sm mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-black transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!fine) return null;

    const printStyles = `
        @media print {
            body { -webkit-print-color-adjust: exact; }
            #fine-form-container { padding: 0; margin: 0; width: 100%; max-width: none; }
            @page { margin: 1cm; size: A4; }
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: printStyles }} />
            <div
                id="fine-form-container"
                data-fine-print-ready={isReady ? 'true' : 'false'}
                className="max-w-[210mm] mx-auto bg-white p-8 text-sm text-black leading-tight"
                style={{ fontFamily: 'Arial, sans-serif' }}
            >
                <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-2">
                    {!logoError ? (
                        <img
                            src="/assets/images/logo.png"
                            alt="VEGA Logo"
                            className="h-12 object-contain"
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <div className="text-right">
                            <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wider">VEGA</h1>
                            <p className="text-[10px] text-gray-600 font-bold tracking-widest">DIGITAL IT SOLUTIONS LLC</p>
                        </div>
                    )}
                    <div className="text-right text-xs font-bold text-gray-800">FINE FORM</div>
                </div>

                <div className="w-full">
                    <div className="bg-[#b3d9ff] border border-black font-bold text-center py-1 border-b-0 text-xs uppercase tracking-wide">
                        Fine Details
                    </div>
                    <table className="w-full border-collapse border border-black mb-4">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[18%] text-xs">Employee Name</td>
                                <td className="border border-black p-1.5 w-[32%] uppercase">{displayName}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[18%] text-xs">Department</td>
                                <td className="border border-black p-1.5 w-[32%] uppercase">{employeeStats.department || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">HOD Name</td>
                                <td className="border border-black p-1.5">{hodName}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Designation</td>
                                <td className="border border-black p-1.5 uppercase">{employeeStats.designation || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Type</td>
                                <td className="border border-black p-1.5 uppercase">{fine.fineType}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Reason</td>
                                <td className="border border-black p-1.5 uppercase">{fine.category}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Amount</td>
                                <td className="border border-black p-1.5 font-semibold text-red-700">
                                    {Number(fine.fineAmount || 0).toLocaleString()}{' '}
                                    <span className="text-black text-[10px] font-normal">AED</span>
                                </td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Service Charge</td>
                                <td className="border border-black p-1.5">{Number(fine.serviceCharge || 0).toFixed(2)}</td>
                            </tr>
                            {(fine.assetId || fine.assetName) && (
                                <tr>
                                    <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Asset ID</td>
                                    <td className="border border-black p-1.5">{fine.assetId || '-'}</td>
                                    <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Asset Name</td>
                                    <td className="border border-black p-1.5">{fine.assetName || '-'}</td>
                                </tr>
                            )}
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs h-24 align-top">Fine Description</td>
                                <td className="border border-black p-1.5 align-top" colSpan={3}>
                                    <div className="whitespace-pre-wrap">{fine.description}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mb-4 text-[11px] text-justify leading-relaxed">
                    I <span className="font-bold underline px-1">{displayName}</span> acknowledge that the fine mentioned above has been
                    committed due to my responsibility. I understand and accept that I am accountable for this charge. I hereby authorize
                    the deduction of the specified amount from my upcoming salary, as per the schedule outlined below:
                </div>

                <div className="w-full">
                    <div className="bg-[#b3d9ff] border border-black font-bold text-center py-1 border-b-0 text-xs uppercase tracking-wide">
                        Account / HR Department
                    </div>
                    <table className="w-full border-collapse border border-black mb-4">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="border border-black p-1.5 w-1/3 text-xs">No Of Installments</th>
                                <th className="border border-black p-1.5 w-1/3 text-xs">Start Month/Year</th>
                                <th className="border border-black p-1.5 w-1/3 text-xs">End Month/Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1.5 text-center font-semibold">{fine.payableDuration || 1}</td>
                                <td className="border border-black p-1.5 text-center">{summaries.startMonthYear}</td>
                                <td className="border border-black p-1.5 text-center">{summaries.endMonthYear}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {!isCompanyFine ? (
                    <table className="w-full border-collapse border border-black mb-4 text-xs">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%]">Visa Expiry</td>
                                <td className="border border-black p-1.5 w-[25%]">{formatDate(employeeStats.visaExpiry)}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%]">Labour Card Expiry</td>
                                <td className="border border-black p-1.5 w-[25%]">{formatDate(employeeStats.labourCardExpiry)}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Joining Date</td>
                                <td className="border border-black p-1.5">{formatDate(employeeStats.joiningDate)}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Year Of Service</td>
                                <td className="border border-black p-1.5">{employeeStats.serviceYears || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Total Fine Count</td>
                                <td className="border border-black p-1.5 font-bold">
                                    {summaries.totalFineCount} ({summaries.totalAmount?.toLocaleString()})
                                </td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Total Fine Categories</td>
                                <td className="border border-black p-1.5 font-bold">{summaries.distinctTypesCount || 0}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Paid Amount</td>
                                <td className="border border-black p-1.5 font-bold text-green-700">
                                    {(summaries.paidFineAmount ?? 0).toLocaleString()}
                                </td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Outstanding Balance</td>
                                <td className="border border-black p-1.5 font-bold text-red-700">
                                    {summaries.outstandingBalance?.toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full border-collapse border border-black mb-4 text-xs">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%]">Total Fine Count</td>
                                <td className="border border-black p-1.5 font-bold w-[25%]">
                                    {summaries.totalFineCount} ({summaries.totalAmount?.toLocaleString()})
                                </td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%]">Total Fine Categories</td>
                                <td className="border border-black p-1.5 w-[25%] font-bold">{summaries.distinctTypesCount || 0}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Paid Amount</td>
                                <td className="border border-black p-1.5 font-bold text-green-700">
                                    {(fine.paidAmount || 0).toLocaleString()}
                                </td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold">Outstanding Balance</td>
                                <td className="border border-black p-1.5 font-bold text-red-700">
                                    {summaries.outstandingBalance?.toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}

                <div className="w-full mb-4">
                    <table className="w-full border-collapse border border-black text-center text-xs">
                        <thead>
                            <tr className="bg-[#b3d9ff]">
                                <th className="border border-black p-1 w-[30%]">Fine Type</th>
                                <th className="border border-black p-1 w-[15%]">Fine Amount</th>
                                <th className="border border-black p-1 w-[20%]">Fine Duration</th>
                                <th className="border border-black p-1 w-[15%]">Paid Amount</th>
                                <th className="border border-black p-1 w-[20%]">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {FINE_TYPES.map((type) => {
                                const agg = aggregates[type.catMatch] || { amount: 0, paid: 0, count: 0, duration: 0 };
                                return (
                                    <tr key={type.catMatch}>
                                        <td className="border border-black p-1 text-left">
                                            {type.label} ({agg.count})
                                        </td>
                                        <td className="border border-black p-1">{agg.amount || 0}</td>
                                        <td className="border border-black p-1">{agg.duration || 0}</td>
                                        <td className="border border-black p-1">{agg.paid || 0}</td>
                                        <td className="border border-black p-1">{(agg.amount || 0) - (agg.paid || 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {!isCompanyFine && (
                    <div className="w-full mb-4">
                        <table className="w-full border-collapse border border-black text-center text-xs">
                            <thead>
                                <tr className="bg-[#b3d9ff]">
                                    <th className="border border-black p-1 w-[30%]">Loan/Salary Advance</th>
                                    <th className="border border-black p-1 w-[15%]">Amount</th>
                                    <th className="border border-black p-1 w-[20%]">Duration</th>
                                    <th className="border border-black p-1 w-[15%]">Paid Amount</th>
                                    <th className="border border-black p-1 w-[20%]">Outstanding</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 text-left">
                                        Personal Loan ({summaries.personalLoan?.count || 0})
                                    </td>
                                    <td className="border border-black p-1">{summaries.personalLoan?.amount?.toLocaleString() || 0}</td>
                                    <td className="border border-black p-1">{summaries.personalLoan?.duration || 0}</td>
                                    <td className="border border-black p-1">{summaries.personalLoan?.paid?.toLocaleString() || 0}</td>
                                    <td className="border border-black p-1">
                                        {((summaries.personalLoan?.amount || 0) - (summaries.personalLoan?.paid || 0)).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-left">
                                        Salary Advance ({summaries.salaryAdvance?.count || 0})
                                    </td>
                                    <td className="border border-black p-1">{summaries.salaryAdvance?.amount?.toLocaleString() || 0}</td>
                                    <td className="border border-black p-1">{summaries.salaryAdvance?.duration || 0}</td>
                                    <td className="border border-black p-1">{summaries.salaryAdvance?.paid?.toLocaleString() || 0}</td>
                                    <td className="border border-black p-1">
                                        {((summaries.salaryAdvance?.amount || 0) - (summaries.salaryAdvance?.paid || 0)).toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex border border-black mb-6 bg-gray-50 text-xs">
                    <div className="w-1/2 p-2 font-bold border-r border-black flex justify-between">
                        <span>Total Outstanding:</span>
                        <span className="text-red-700 text-sm">{summaries.outstandingBalance?.toLocaleString()} AED</span>
                    </div>
                    {!isCompanyFine ? (
                        <div className="w-1/2 p-2 font-bold flex justify-between">
                            <span>Next Month Deduction:</span>
                            <span className="text-sm">{summaries.nextSalaryDeduction?.toLocaleString() || 0} AED</span>
                        </div>
                    ) : (
                        <div className="w-1/2 p-2 font-bold flex justify-between">
                            <span>Company Fine Amount:</span>
                            <span className="text-sm">{summaries.outstandingBalance?.toLocaleString()} AED</span>
                        </div>
                    )}
                </div>

                <div className="mb-2 text-xs font-bold uppercase underline">Acknowledged By:</div>
                <FineFormSignatureRow signatures={signatureState} isCompanyFine={isCompanyFine} />

                <div className="mt-8 flex justify-between items-end border-t-2 border-gray-300 pt-3 text-[10px] text-gray-500 leading-tight">
                    <div>
                        <p><strong>T:</strong> +971 4 340 99 88</p>
                        <p><strong>E:</strong> hello@vitsllc.com</p>
                        <p><strong>W:</strong> www.vitsllc.com</p>
                    </div>
                    <div className="text-center">
                        <p>Damascus Street, Qusais, Al Mansoor Building</p>
                        <p>4th Floor, Office 406, Dubai, UAE</p>
                        <p>PO Box: 18845</p>
                    </div>
                    <div>
                        <img
                            src="/assets/images/iso.png"
                            alt="ISO"
                            className="h-8 object-contain"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
