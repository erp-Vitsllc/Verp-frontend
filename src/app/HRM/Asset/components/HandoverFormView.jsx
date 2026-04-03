'use client';

import React from 'react';

const HandoverFormView = React.forwardRef(({ asset, assets = [], employee, isPrint = false, overrideDate = null }, ref) => {
    // Determine which data to use: singular asset or list of assets
    const displayAssets = assets.length > 0 ? assets : (asset ? [asset] : []);

    if (displayAssets.length === 0) return null;

    // Use the first asset's employee data (assuming all selected assets go to the same person)
    const primaryAsset = displayAssets[0];

    const isCompanyAllocation =
        String(primaryAsset.assignedToType || '').toLowerCase() === 'company' && primaryAsset.assignedCompany;
    const companyObj =
        primaryAsset.assignedCompany && typeof primaryAsset.assignedCompany === 'object'
            ? primaryAsset.assignedCompany
            : null;
    const companyDisplayName = companyObj?.name || '';

    const handoverByName = primaryAsset.assignedBy
        ? `${primaryAsset.assignedBy.firstName} ${primaryAsset.assignedBy.lastName}`
        : 'HR Department';

    // Use the full signature object from assignedTo so getSignatureUrl can handle nested { url } shape
    // Safely resolve assigned employee data (handles populated objects or just IDs)
    const assignedEmp = (primaryAsset.assignedTo && typeof primaryAsset.assignedTo === 'object')
        ? {
            ...primaryAsset.assignedTo,
            ...(employee ? { signature: employee.signature || primaryAsset.assignedTo?.signature } : {})
        }
        : (employee || {}); // Fallback to provided employee or empty object

    const isAcceptedByManager = primaryAsset.acceptedBy &&
        primaryAsset.assignedTo &&
        (primaryAsset.acceptedBy._id || primaryAsset.acceptedBy).toString() !==
        (primaryAsset.assignedTo._id || primaryAsset.assignedTo).toString();

    /** Who appears under "Received and Acknowledge": employee assignee, manager delegate, or HR (company). */
    const acknowledgeRecipient = (() => {
        if (isCompanyAllocation && primaryAsset.acceptedBy) {
            return { source: primaryAsset.acceptedBy, kind: 'hr' };
        }
        if (isAcceptedByManager && primaryAsset.acceptedBy) {
            return { source: primaryAsset.acceptedBy, kind: 'manager' };
        }
        return { source: assignedEmp, kind: 'assignee' };
    })();

    const formatPersonName = (p) => {
        if (!p || typeof p !== 'object') return '';
        const fn = p.firstName != null ? String(p.firstName) : '';
        const ln = p.lastName != null ? String(p.lastName) : '';
        const t = `${fn} ${ln}`.trim();
        return t;
    };

    const acknowledgeDisplayName = formatPersonName(acknowledgeRecipient.source);

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
        printColorAdjust: 'exact',
        minHeight: '297mm'
    };

    const getSignatureUrl = (sig) => {
        if (!sig) return null;

        // Extract URL/Data from possible object shapes
        let url = null;
        if (typeof sig === 'string') {
            url = sig;
        } else if (typeof sig === 'object') {
            // Handle { url: "..." } or { data: "..." } or { signature: "..." } or direct string
            url = sig.url || sig.data || sig.path ||
                (typeof sig.signature === 'string' ? sig.signature : (sig.signature?.url || sig.signature?.data)) ||
                null;
        }

        if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null' || url.includes('[object Object]')) return null;

        // 1. Handle Base64 Data
        if (url.startsWith('data:')) return url;

        // 2. Handle Absolute URLs
        if (url.startsWith('http')) return url;

        // 3. Handle Relative Paths
        // Normalize: ensure it starts with /
        let normalizedPath = url.startsWith('/') ? url : `/${url}`;

        // Define common base for backend assets
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

        // Check if it's an upload path (common patterns: /uploads, /signatures, /public)
        const isUpload = normalizedPath.includes('uploads') || normalizedPath.includes('signatures');

        if (isUpload || !normalizedPath.startsWith('/assets')) {
            // Prepend API base for backend files
            return `${apiBase}${normalizedPath}`.replace(/([^:]\/)\/+/g, "$1"); // Normalize slashes
        }

        return normalizedPath;
    };

    return (
        <div
            ref={ref}
            style={bgStyle}
            id="handover-form-main"
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
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">
                                {isCompanyAllocation ? 'Company' : 'Employee Name'}
                            </td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">
                                {isCompanyAllocation
                                    ? companyDisplayName || '—'
                                    : assignedEmp.firstName || assignedEmp.lastName
                                      ? `${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim()
                                      : 'N/A'}
                            </td>
                            <td className="border border-gray-400 p-2 w-1/4 bg-gray-50/40 text-gray-600 font-medium">Handover By</td>
                            <td className="border border-gray-400 p-2 w-1/4 text-gray-900 font-bold">{handoverByName}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">
                                {isCompanyAllocation ? 'Company ID' : 'Employee Code'}
                            </td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">
                                {isCompanyAllocation ? companyObj?.companyId || '—' : assignedEmp.employeeId || '—'}
                            </td>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Handover Date</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{formatDate(overrideDate || new Date())}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">HOD Name</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">
                                {(() => {
                                    const hod = assignedEmp.primaryReportee || assignedEmp.reportingAuthority;
                                    if (!hod) return '—';
                                    if (typeof hod === 'object' && (hod.firstName || hod.lastName)) {
                                        return `${hod.firstName || ''} ${hod.lastName || ''}`.trim();
                                    }
                                    return '—';
                                })()}
                            </td>
                            <td className="border border-gray-400 p-2 bg-gray-50/40 text-gray-600 font-medium">Department</td>
                            <td className="border border-gray-400 p-2 text-gray-900 font-bold">{assignedEmp.department || '—'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-[13px] font-medium my-4 italic text-gray-600">
                {isCompanyAllocation
                    ? `Please find the below assets allocated to ${companyDisplayName || 'the company'}:`
                    : 'Please find the below assets handed over to you to carry out your assignment:'}
            </p>

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
                            <tr key={item._id?.toString() || item.assetId || `asset-${idx}`}>
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
                    (asset.accessories || [])
                        .filter(acc => acc.status === 'Attached' || !acc.status)
                        .map((acc, localIdx) => ({
                            ...acc,
                            parentAssetId: asset.assetId,
                            suffix: String.fromCharCode(65 + localIdx)
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
                                    <tr key={acc._id?.toString() || acc.accessoryId || `acc-${idx}`}>
                                        <td className="border border-gray-400 p-2 text-center font-medium">{idx + 1}</td>
                                        <td className="border border-gray-400 p-2 italic">{acc.name}</td>
                                        <td className="border border-gray-400 p-2 font-mono font-bold text-blue-800">
                                            {acc.accessoryId || `${acc.parentAssetId}${acc.suffix}`}
                                        </td>
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
            <div className="mb-10 font-serif text-[14px] text-black font-bold">
                <span className="uppercase text-[11px] text-gray-500 font-medium tracking-wider mb-2 block">Handover By</span>

                <div className="flex items-center gap-10">
                    <span className="text-gray-900 inline-block min-h-[24px] leading-none mb-0">
                        {primaryAsset.assignedBy ? `${primaryAsset.assignedBy.firstName} ${primaryAsset.assignedBy.lastName}` : ''}
                    </span>

                    {(() => {
                        const sig = primaryAsset.assignedBy?.signature || primaryAsset.assignedBy;
                        const url = getSignatureUrl(sig);
                        if (!url || url.includes('[object Object]')) return null;
                        return (
                            <div className="h-16 w-32 overflow-hidden">
                                <img
                                    src={url}
                                    alt="Sign"
                                    className="h-full w-full object-contain object-left"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Declaration */}
            <div className="space-y-4 mb-8">
                <h3 className="text-[13px] font-bold underline uppercase text-gray-900 tracking-wide">Acknowledgment & Declaration:</h3>
                <p className="text-[14px] text-justify leading-[1.6] text-gray-500">
                    {isCompanyAllocation ? (
                        <>
                            The organization <span className="font-bold border-b-2 border-dotted border-gray-800 px-2">{companyDisplayName || '—'}</span> acknowledges receipt of the above-mentioned assets allocated for company use. These assets remain company property and must be safeguarded in line with company policy. Loss or damage may be addressed per company and HR procedures.
                        </>
                    ) : (
                        <>
                            I, Mr./Ms. <span className="font-bold border-b-2 border-dotted border-gray-800 px-6">{assignedEmp.firstName} {assignedEmp.lastName}</span> hereby acknowledge that I have received the above-mentioned assets. I understand that this asset belongs to company and is under my possession for carrying out my work. I hereby assure that I will take care of the assets of the company to the possible extend. And if any damage or loss, I am liable either to buy or willing to pay/get deducted from my salary.
                        </>
                    )}
                </p>
            </div>

            {/* Final Signature Section */}
            <div className="mt-12 pb-4 font-serif text-[14px] text-black font-bold">
                <div className="flex flex-col">
                    <span className="uppercase text-[11px] text-gray-500 font-medium tracking-wider mb-2 block">Received and Acknowledge</span>

                    {primaryAsset.acceptanceStatus === 'Accepted' && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-10">
                                <span className="text-gray-900 inline-block min-h-[24px] leading-none mb-0 uppercase whitespace-nowrap">
                                    {acknowledgeDisplayName || '—'}
                                </span>

                                {getSignatureUrl(
                                    acknowledgeRecipient.kind === 'assignee'
                                        ? assignedEmp.signature
                                        : primaryAsset.acceptedBy?.signature
                                ) && (
                                    <div className="h-16 w-32 overflow-hidden">
                                        <img
                                            src={getSignatureUrl(
                                                acknowledgeRecipient.kind === 'assignee'
                                                    ? assignedEmp.signature
                                                    : primaryAsset.acceptedBy?.signature
                                            )}
                                            alt="Signature"
                                            className="h-full w-full object-contain object-left"
                                        />
                                    </div>
                                )}
                            </div>
                            {acknowledgeRecipient.kind === 'manager' && (
                                <span className="text-[10px] text-gray-500 font-medium italic">
                                    Approved and acknowledged by manager on behalf of employee
                                </span>
                            )}
                            {acknowledgeRecipient.kind === 'hr' && (
                                <span className="text-[10px] text-gray-500 font-medium italic">
                                    Acknowledged by HR representative on behalf of the company
                                </span>
                            )}
                        </div>
                    )}

                    {primaryAsset.acceptanceStatus !== 'Accepted' && (
                        <div className="h-16 border-b border-gray-300 w-full mt-4"></div>
                    )}
                </div>
            </div>

            {/* Print Date Metadata */}
            <div className="mt-auto pt-10 flex justify-between items-end text-[10px] text-gray-400 font-mono italic">
                <div>
                    Document Generated: {new Date().toLocaleString()}
                </div>
                <div>
                    Action Date: {formatDate(overrideDate || primaryAsset.updatedAt || new Date())}
                </div>
            </div>
        </div>
    );
});

HandoverFormView.displayName = 'HandoverFormView';

export default HandoverFormView;
