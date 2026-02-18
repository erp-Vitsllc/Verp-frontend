'use client';

import React from 'react';

const HandoverFormView = React.forwardRef(({ asset, assets = [], isPrint = false }, ref) => {
    // Determine which data to use: singular asset or list of assets
    const displayAssets = assets.length > 0 ? assets : (asset ? [asset] : []);

    if (displayAssets.length === 0) return null;

    // Use the first asset's employee data (assuming all selected assets go to the same person)
    const primaryAsset = displayAssets[0];
    const assignedEmp = primaryAsset.assignedTo || {};

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Background styling
    const bgStyle = {
        backgroundImage: 'url("/assets/forms/handover_bg.jpg")',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
    };

    return (
        <div
            ref={ref}
            style={bgStyle}
            className={`${isPrint ? 'shadow-none border-none p-[25mm_20mm_30mm_20mm]' : 'shadow-sm border border-gray-200 mx-auto bg-white p-[35mm_20mm_40mm_20mm] min-h-[297mm]'} w-[210mm] h-auto text-[#333] font-serif leading-relaxed relative flex flex-col`}
        >
            {/* Custom Styles for Printing Backgrounds */}
            <style jsx>{`
                @media print {
                    div {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
            <h1 className="text-2xl font-semibold text-center underline mb-10 tracking-widest uppercase mt-6 text-gray-900">Asset Handover Form</h1>

            {/* Employee & Handover Info Table */}
            <div className="border border-gray-400 mb-6">
                <table className="w-full border-collapse text-[10px] font-serif uppercase tracking-wide">
                    <tbody>
                        <tr>
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">Employee Name</td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">{assignedEmp.firstName} {assignedEmp.lastName}</td>
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">Handover By</td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">HR Department</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Employee Code</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{assignedEmp.employeeId || '—'}</td>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Handover Date</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{formatDate(new Date())}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">HOD Name</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">
                                {(() => {
                                    const hod = assignedEmp.primaryReportee || assignedEmp.reportingAuthority;
                                    if (!hod) return '—';
                                    if (typeof hod === 'object') {
                                        const name = `${hod.firstName || ''} ${hod.lastName || ''}`.trim();
                                        return name || hod.employeeId || '—';
                                    }
                                    return hod; // Return ID if not populated
                                })()}
                            </td>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Department</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{assignedEmp.department || '—'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-[13px] font-medium my-4 italic text-gray-600">Please find the below assets handed over to you to carry out your assignment:</p>

            {/* Main Assets Table */}
            <div className="mb-6">
                <h3 className="text-[11px] font-bold uppercase mb-2 text-gray-700">Main Item(s)</h3>
                <table className="w-full border-collapse text-[10px]">
                    <thead className="bg-gray-50/40 font-bold uppercase tracking-wider text-gray-700">
                        <tr>
                            <th className="border border-gray-400 p-2 w-14 text-center">S. No.</th>
                            <th className="border border-gray-400 p-3 text-left">Item Name</th>
                            <th className="border border-gray-400 p-3 text-left">Asset ID</th>
                            <th className="border border-gray-400 p-3 w-20 text-center">Qty</th>
                            <th className="border border-gray-400 p-3 text-left">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800">
                        {displayAssets.map((item, idx) => (
                            <tr key={item._id}>
                                <td className="border border-gray-400 p-3 text-center font-bold">{idx + 1}</td>
                                <td className="border border-gray-400 p-3 font-semibold">{item.name}</td>
                                <td className="border border-gray-400 p-3 font-mono font-bold text-blue-800">{item.assetId}</td>
                                <td className="border border-gray-400 p-3 text-center">1</td>
                                <td className="border border-gray-400 p-3 text-gray-400 italic">Core Asset</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Accessories Table */}
            {(() => {
                const allAccessories = displayAssets.flatMap(asset =>
                    (asset.accessories || []).map((acc, localIdx) => ({
                        ...acc,
                        parentAssetId: asset.assetId,
                        suffix: String.fromCharCode(65 + localIdx) // 65 is 'A', 66 is 'B', etc.
                    }))
                );

                if (allAccessories.length === 0) return null;

                return (
                    <div className="mb-8">
                        <h3 className="text-[11px] font-bold uppercase mb-2 text-gray-700">Attached Accessories</h3>
                        <table className="w-full border-collapse text-[10px]">
                            <thead className="bg-gray-50/40 font-bold uppercase tracking-wider text-gray-700">
                                <tr>
                                    <th className="border border-gray-400 p-2 w-14 text-center">S. No.</th>
                                    <th className="border border-gray-400 p-2 text-left">Accessory Name</th>
                                    <th className="border border-gray-400 p-2 text-left">ACCESSORY ID</th>
                                    <th className="border border-gray-400 p-2 w-20 text-center">Qty</th>
                                    <th className="border border-gray-400 p-2 text-left">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-800">
                                {allAccessories.map((acc, idx) => (
                                    <tr key={`acc-${idx}`}>
                                        <td className="border border-gray-400 p-2 text-center font-medium">{idx + 1}</td>
                                        <td className="border border-gray-400 p-2 italic">{acc.name}</td>
                                        <td className="border border-gray-400 p-2 font-mono font-bold text-blue-800">{acc.parentAssetId}{acc.suffix}</td>
                                        <td className="border border-gray-400 p-2 text-center">1</td>
                                        <td className="border border-gray-400 p-2 text-gray-400 italic">Included</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })()}

            {/* Signatures Row 1 */}
            {/* Signatures Row 1 */}
            <div className="mb-10 font-serif text-[14px] text-black font-bold">
                <span className="uppercase text-[11px] text-gray-500 font-medium tracking-wider mb-2 block">Handover By</span>

                <div className="flex items-center gap-10">
                    <span className="text-gray-900 inline-block min-h-[24px] leading-none mb-0">
                        {primaryAsset.assignedBy ? `${primaryAsset.assignedBy.firstName} ${primaryAsset.assignedBy.lastName}` : ''}
                    </span>

                    {(primaryAsset.assignedBy?.signature?.url || primaryAsset.assignedBy?.signature) && (
                        <div className="h-16 w-32 overflow-hidden">
                            <img
                                src={primaryAsset.assignedBy.signature?.url || primaryAsset.assignedBy.signature}
                                alt="Sign"
                                className="h-full w-full object-contain object-left"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Declaration */}
            <div className="space-y-4 mb-8">
                <h3 className="text-[13px] font-bold underline uppercase text-gray-900 tracking-wide">Acknowledgment & Declaration:</h3>
                <p className="text-[14px] text-justify leading-[1.6] text-gray-500">
                    I, Mr./Ms. <span className="font-bold border-b-2 border-dotted border-gray-800 px-6">{assignedEmp.firstName} {assignedEmp.lastName}</span> hereby acknowledge that I have received the above-mentioned assets. I understand that this asset belongs to company and is under my possession for carrying out my work. I hereby assure that I will take care of the assets of the company to the possible extend. And if any damage or loss, I am liable either to buy or willing to pay/get deducted from my salary.
                </p>
            </div>

            {/* Final Signature Section */}
            <div className="mt-12 pb-4 font-serif text-[14px] text-black font-bold">
                <div className="flex flex-col">
                    <span className="uppercase text-[11px] text-gray-500 font-medium tracking-wider mb-2 block">Received and Acknowledge</span>

                    {primaryAsset.acceptanceStatus === 'Accepted' && (
                        <div className="flex items-center gap-10">
                            <span className="text-gray-900 inline-block min-h-[24px] leading-none mb-0 uppercase whitespace-nowrap">
                                {assignedEmp.firstName} {assignedEmp.lastName}
                            </span>

                            {(assignedEmp.signature?.url || assignedEmp.signature) && (
                                <div className="h-16 w-32 overflow-hidden">
                                    <img
                                        src={assignedEmp.signature?.url || assignedEmp.signature}
                                        alt="User Signature"
                                        className="h-full w-full object-contain object-left"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {primaryAsset.acceptanceStatus !== 'Accepted' && (
                        <div className="h-16 border-b border-gray-300 w-full mt-4"></div>
                    )}
                </div>
            </div>
        </div>
    );
});

HandoverFormView.displayName = 'HandoverFormView';

export default HandoverFormView;
