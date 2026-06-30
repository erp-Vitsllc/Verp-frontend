'use client';

import React from 'react';

function filterAttachedAccessories(accList) {
    if (!Array.isArray(accList)) return [];
    return accList.filter((acc) => {
        const st = String(acc?.status || '').trim();
        return !st || st === 'Attached';
    });
}

function formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveHodName(employee) {
    const hod = employee?.primaryReportee || employee?.reportingAuthority;
    if (!hod) return '—';
    if (typeof hod === 'object') {
        const name = `${hod.firstName || ''} ${hod.lastName || ''}`.trim();
        return name || hod.employeeId || '—';
    }
    return String(hod);
}

function buildAssetRows(assets) {
    return (assets || []).filter(Boolean).map((asset) => {
        const assignedDate =
            asset.status === 'Returned'
                ? asset.updatedAt
                : asset.assignedDate || asset.updatedAt;

        return {
            name: asset.name || '—',
            value: Number(asset.assetValue) || 0,
            assignedDate,
            status: asset.status || 'Assigned',
            accessories: filterAttachedAccessories(asset.accessories).map((acc) => ({
                name: acc.name || '—',
                price: Number(acc.amount) || 0,
            })),
        };
    });
}

export default function AssetListFormView({ employee, assets = [], isPrint = false }) {
    const rows = buildAssetRows(assets);
    const employeeName = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || '—';
    const listDate = formatDate(new Date());
    const total = rows.reduce((sum, row) => {
        const accTotal = row.accessories.reduce((s, acc) => s + (Number(acc.price) || 0), 0);
        return sum + row.value + accTotal;
    }, 0);

    const bgStyle = {
        backgroundImage: 'url("/assets/handover_form_bg.png")',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        minHeight: '297mm',
    };

    return (
        <div
            id="employee-asset-list-form"
            style={bgStyle}
            className={`${isPrint ? 'shadow-none border-none p-[25mm_20mm_30mm_20mm]' : 'shadow-sm border border-gray-200 mx-auto bg-white p-[35mm_20mm_40mm_20mm] min-h-[297mm]'} w-[210mm] h-auto text-black font-serif leading-relaxed relative flex flex-col`}
        >
            <style jsx>{`
                @media print {
                    div {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <h1 className="text-2xl font-semibold text-center underline mb-10 tracking-widest uppercase mt-6 text-gray-900">
                Asset List
            </h1>

            <div className="border border-gray-400 mb-6">
                <table className="w-full border-collapse text-[10px] font-serif uppercase tracking-wide">
                    <tbody>
                        <tr>
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">Date</td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">{listDate}</td>
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">Employee Name</td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">{employeeName}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Employee Code</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{employee?.employeeId || '—'}</td>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">HOD Name</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{resolveHodName(employee)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mb-6">
                <table className="w-full border-collapse text-[10px]">
                    <thead className="bg-gray-50/40 font-bold uppercase tracking-wider text-gray-900">
                        <tr>
                            <th className="border border-gray-400 p-2 w-10 text-center">#</th>
                            <th className="border border-gray-400 p-2 text-left">Asset Name</th>
                            <th className="border border-gray-400 p-2 w-24 text-center">Value (AED)</th>
                            <th className="border border-gray-400 p-2 w-24 text-center">Assigned Date</th>
                            <th className="border border-gray-400 p-2 w-44 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-900">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="border border-gray-400 p-4 text-center text-gray-500">
                                    No assets assigned
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={`asset-row-${index}`}>
                                    <td className="border border-gray-400 p-2 text-center font-bold">{index + 1}</td>
                                    <td className="border border-gray-400 p-2 font-semibold">{row.name}</td>
                                    <td className="border border-gray-400 p-2 text-center font-bold">{formatMoney(row.value)}</td>
                                    <td className="border border-gray-400 p-2 text-center">{formatDate(row.assignedDate)}</td>
                                    <td className="border border-gray-400 p-2 align-top text-center">
                                        <div className="font-bold text-[10px] mb-1">{row.status}</div>
                                        {row.accessories.length === 0 ? (
                                            <div className="mt-2 py-1 text-[9px] font-bold uppercase border border-gray-300 text-gray-700">
                                                NO ACC
                                            </div>
                                        ) : (
                                            <table className="w-full border-collapse text-[9px] mt-2">
                                                <thead>
                                                    <tr className="bg-gray-50/50">
                                                        <th colSpan={2} className="border border-gray-400 p-1 font-bold uppercase">
                                                            Accessories
                                                        </th>
                                                    </tr>
                                                    <tr className="bg-gray-50/40">
                                                        <th className="border border-gray-400 p-1 text-left font-bold">Name</th>
                                                        <th className="border border-gray-400 p-1 font-bold w-16">Price (AED)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {row.accessories.map((acc, accIdx) => (
                                                        <tr key={`acc-${index}-${accIdx}`}>
                                                            <td className="border border-gray-400 p-1 text-left font-semibold">
                                                                {accIdx + 1}. {acc.name}
                                                            </td>
                                                            <td className="border border-gray-400 p-1 text-center font-bold">
                                                                {formatMoney(acc.price)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                        {rows.length > 0 && (
                            <tr>
                                <td colSpan={2} className="border border-gray-400 p-2 text-right font-bold uppercase">
                                    Total
                                </td>
                                <td className="border border-gray-400 p-2 text-center font-bold">{formatMoney(total)}</td>
                                <td colSpan={2} className="border border-gray-400 p-2" />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-auto pt-10 flex justify-between items-end text-[10px] text-gray-400 font-mono italic">
                <div>Document Generated: {new Date().toLocaleString()}</div>
                <div>List Date: {listDate}</div>
            </div>
        </div>
    );
}
