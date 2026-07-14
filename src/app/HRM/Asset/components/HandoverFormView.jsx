'use client';

import React from 'react';
import {
    VitsLetterheadDocument,
    VitsLetterheadPage,
    VitsSignatureBlock,
    VITS_PDF_BORDER,
    VITS_PDF_FONT_FAMILY,
    VITS_PDF_INK,
} from '@/pdf/vitsLetterhead';

/**
 * Tools Asset Handover Form — print/PDF presentation layer only.
 * Props and data derivation stay the same for existing ERP flows.
 * Single A4 letterhead page: content flows continuously with no empty page gap.
 */
const HandoverFormView = React.forwardRef(({ asset, assets = [], employee, isPrint = false, overrideDate = null }, ref) => {
    const displayAssets = assets.length > 0 ? assets : (asset ? [asset] : []);

    if (displayAssets.length === 0) return null;

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

    const assignedEmp = (primaryAsset.assignedTo && typeof primaryAsset.assignedTo === 'object')
        ? {
            ...primaryAsset.assignedTo,
            ...(employee ? { signature: employee.signature || primaryAsset.assignedTo?.signature } : {})
        }
        : (employee || {});

    const assigneeAcknowledgeName = isCompanyAllocation
        ? companyDisplayName || '—'
        : `${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim() || '—';

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatPrice = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getSignatureUrl = (sig) => {
        if (!sig) return null;

        let url = null;
        if (typeof sig === 'string') {
            url = sig;
        } else if (typeof sig === 'object') {
            url = sig.url || sig.data || sig.path ||
                (typeof sig.signature === 'string' ? sig.signature : (sig.signature?.url || sig.signature?.data)) ||
                null;
        }

        if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null' || url.includes('[object Object]')) return null;

        if (url.startsWith('data:')) return url;
        if (url.startsWith('http')) return url;

        let normalizedPath = url.startsWith('/') ? url : `/${url}`;
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
        const isUpload = normalizedPath.includes('uploads') || normalizedPath.includes('signatures');

        if (isUpload || !normalizedPath.startsWith('/assets')) {
            return `${apiBase}${normalizedPath}`.replace(/([^:]\/)\/+/g, "$1");
        }

        return normalizedPath;
    };

    const attachedAccessories = displayAssets.flatMap((assetRow) =>
        (assetRow.accessories || [])
            .filter((acc) => acc.status === 'Attached' || !acc.status)
            .map((acc, localIdx) => ({
                ...acc,
                parentAssetId: assetRow.assetId,
                suffix: String.fromCharCode(65 + localIdx),
            })),
    );

    const assetsTotal = displayAssets.reduce((sum, item) => sum + (Number(item.assetValue) || 0), 0);
    const accessoriesTotal = attachedAccessories.reduce((sum, acc) => sum + (Number(acc.amount) || 0), 0);
    const handoverGrandTotal = assetsTotal + accessoriesTotal;

    const generatedAt = new Date();
    const actionDateRaw = overrideDate || primaryAsset.updatedAt || primaryAsset.assignedDate || generatedAt;

    const fontFamily = VITS_PDF_FONT_FAMILY;
    const ink = VITS_PDF_INK;
    const border = VITS_PDF_BORDER;
    const textStyle = {
        fontFamily,
        fontSize: '12pt',
        fontWeight: 500,
        fontStyle: 'normal',
        color: ink,
        lineHeight: 1.15,
    };

    const sectionTitleStyle = {
        ...textStyle,
        fontSize: '13pt',
        fontWeight: 700,
        margin: '0 0 8px 0',
        letterSpacing: '0.02em',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        borderBottom: 'none',
        paddingBottom: 0,
        display: 'inline-block',
        width: 'auto',
    };

    // Borders only — compact cells; data not bold
    const thStyle = {
        ...textStyle,
        fontSize: '10pt',
        fontWeight: 500,
        border: `1px solid ${border}`,
        background: 'transparent',
        padding: '1px 4px',
        textAlign: 'left',
        lineHeight: 1.1,
        verticalAlign: 'middle',
    };

    const tdStyle = {
        ...textStyle,
        fontSize: '10pt',
        fontWeight: 500,
        border: `1px solid ${border}`,
        background: 'transparent',
        padding: '1px 4px',
        verticalAlign: 'middle',
        wordBreak: 'break-word',
        lineHeight: 1.1,
    };

    const labelCellStyle = {
        ...tdStyle,
        width: '22%',
    };

    const valueCellStyle = {
        ...tdStyle,
        width: '28%',
    };

    const handoverBySigUrl = getSignatureUrl(
        primaryAsset.assignedBy?.signature || primaryAsset.assignedBy
    );
    const receivedSigUrl = getSignatureUrl(
        isCompanyAllocation
            ? primaryAsset.acceptedBy?.signature
            : assignedEmp.signature
    );

    return (
        <VitsLetterheadDocument
            rootRef={ref}
            id="handover-form-main"
            className={isPrint ? '' : 'shadow-sm border border-gray-200 mx-auto bg-white'}
        >
            {/* ── Page 1: details + assets ── */}
            <VitsLetterheadPage
                isLast
                pageFooter={(
                    <p
                        className="vits-doc-generated"
                        style={{
                            ...textStyle,
                            color: '#4b5563',
                            textAlign: 'left',
                        }}
                    >
                        Document Generated:{' '}
                        {generatedAt.toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                        })}
                    </p>
                )}
            >
                <header style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <h1
                        className="vits-doc-title"
                        style={{
                            ...textStyle,
                            fontSize: '18pt',
                            fontWeight: 700,
                            margin: 0,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            textDecoration: 'underline',
                            textUnderlineOffset: '4px',
                            borderBottom: 'none',
                            display: 'inline-block',
                        }}
                    >
                        Asset Handover Form
                    </h1>
                </header>

                <section style={{ marginBottom: '0' }}>
                    <h2 className="vits-section-title" style={sectionTitleStyle}>Employee Information</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${border}`, background: 'transparent' }}>
                        <tbody>
                            <tr>
                                <td style={labelCellStyle}>
                                    {isCompanyAllocation ? 'Company' : 'Employee Name'}
                                </td>
                                <td style={valueCellStyle}>
                                    {isCompanyAllocation
                                        ? companyDisplayName || '—'
                                        : assignedEmp.firstName || assignedEmp.lastName
                                          ? `${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim()
                                          : 'N/A'}
                                </td>
                                <td style={labelCellStyle}>Handover By</td>
                                <td style={valueCellStyle}>{handoverByName}</td>
                            </tr>
                            <tr>
                                <td style={labelCellStyle}>
                                    {isCompanyAllocation ? 'Company ID' : 'Employee Code'}
                                </td>
                                <td style={valueCellStyle}>
                                    {isCompanyAllocation ? companyObj?.companyId || '—' : assignedEmp.employeeId || '—'}
                                </td>
                                <td style={labelCellStyle}>Handover Date</td>
                                <td style={valueCellStyle}>{formatDate(overrideDate || new Date())}</td>
                            </tr>
                            <tr>
                                <td style={labelCellStyle}>HOD Name</td>
                                <td style={valueCellStyle}>
                                    {(() => {
                                        const hod = assignedEmp.primaryReportee || assignedEmp.reportingAuthority;
                                        if (!hod) return '—';
                                        if (typeof hod === 'object' && (hod.firstName || hod.lastName)) {
                                            return `${hod.firstName || ''} ${hod.lastName || ''}`.trim();
                                        }
                                        return '—';
                                    })()}
                                </td>
                                <td style={labelCellStyle}>Department</td>
                                <td style={valueCellStyle}>{assignedEmp.department || '—'}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <p
                    style={{
                        ...textStyle,
                        margin: '16px 0',
                        color: ink,
                        border: 'none',
                    }}
                >
                    {isCompanyAllocation
                        ? `Please find the below assets allocated to ${companyDisplayName || 'the company'}:`
                        : 'Please find the below assets handed over to you to carry out your assignment:'}
                </p>

                <section style={{ marginBottom: '8px' }}>
                    <h2 className="vits-section-title" style={sectionTitleStyle}>Main Assets</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${border}`, background: 'transparent' }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, width: '48px', textAlign: 'center' }}>S. No.</th>
                                <th style={thStyle}>Item Name</th>
                                <th style={{ ...thStyle, width: '22%' }}>Asset ID</th>
                                <th style={{ ...thStyle, width: '52px', textAlign: 'center' }}>Qty</th>
                                <th style={{ ...thStyle, width: '110px', textAlign: 'right' }}>Price</th>
                                <th style={thStyle}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayAssets.map((item, idx) => (
                                <tr key={item._id?.toString() || item.assetId || `asset-${idx}`}>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={tdStyle}>{item.name || '—'}</td>
                                    <td style={tdStyle}>{item.assetId || '—'}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>1</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {formatPrice(item.assetValue)}
                                    </td>
                                    <td style={tdStyle}>Core Asset</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section style={{ marginBottom: '8px' }}>
                    <h2 className="vits-section-title" style={sectionTitleStyle}>Attached Accessories</h2>
                    {attachedAccessories.length === 0 ? (
                        <p
                            style={{
                                ...textStyle,
                                margin: 0,
                                padding: '8px 10px',
                                border: `1px solid ${border}`,
                                background: 'transparent',
                            }}
                        >
                            No accessories attached
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${border}`, background: 'transparent' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '48px', textAlign: 'center' }}>S. No.</th>
                                    <th style={thStyle}>Accessory Name</th>
                                    <th style={{ ...thStyle, width: '22%' }}>Accessory ID</th>
                                    <th style={{ ...thStyle, width: '52px', textAlign: 'center' }}>Qty</th>
                                    <th style={{ ...thStyle, width: '110px', textAlign: 'right' }}>Price</th>
                                    <th style={thStyle}>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attachedAccessories.map((acc, idx) => (
                                    <tr key={acc._id?.toString() || acc.accessoryId || `acc-${idx}`}>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={tdStyle}>{acc.name || '—'}</td>
                                        <td style={tdStyle}>
                                            {acc.accessoryId || `${acc.parentAssetId}${acc.suffix}`}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>1</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {formatPrice(acc.amount)}
                                        </td>
                                        <td style={tdStyle}>Included</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section
                    className="vits-avoid-break"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '24px',
                        marginBottom: '8px',
                        width: '100%',
                    }}
                >
                    {/* Handover By — left */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <VitsSignatureBlock
                            title="Handover By"
                            name={handoverByName}
                            dateLabel={formatDate(overrideDate || primaryAsset.assignedDate || generatedAt)}
                            signatureUrl={handoverBySigUrl}
                        />
                    </div>

                    {/* Totals — right */}
                    <div
                        style={{
                            width: 'min(100%, 280px)',
                            flexShrink: 0,
                            border: `1.5px solid ${border}`,
                            background: 'transparent',
                            padding: '4px 8px',
                        }}
                    >
                        <div style={{ ...textStyle, display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Total Assets</span>
                            <span>{formatPrice(assetsTotal)}</span>
                        </div>
                        <div style={{ ...textStyle, display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Total Accessories</span>
                            <span>{formatPrice(accessoriesTotal)}</span>
                        </div>
                        <div
                            style={{
                                ...textStyle,
                                display: 'flex',
                                justifyContent: 'space-between',
                                borderTop: `1px solid ${border}`,
                                paddingTop: '4px',
                            }}
                        >
                            <span>Grand Total</span>
                            <span>{formatPrice(handoverGrandTotal)}</span>
                        </div>
                    </div>
                </section>

                <section
                    className="vits-avoid-break vits-declaration"
                    style={{
                        marginBottom: '10px',
                        padding: '0',
                        background: 'transparent',
                    }}
                >
                    <h2 className="vits-section-title" style={sectionTitleStyle}>Acknowledgment &amp; Declaration</h2>
                    <p
                        style={{
                            ...textStyle,
                            textAlign: 'justify',
                            margin: 0,
                            background: 'transparent',
                        }}
                    >
                        {isCompanyAllocation ? (
                            <>
                                The organization{' '}
                                <span style={{ borderBottom: `1px dotted ${ink}`, padding: '0 4px' }}>
                                    {companyDisplayName || '—'}
                                </span>{' '}
                                acknowledges receipt of the above-mentioned assets allocated for company use. These assets
                                remain company property and must be safeguarded in line with company policy. Loss or damage
                                may be addressed per company and HR procedures.
                            </>
                        ) : (
                            <>
                                I, Mr./Ms.{' '}
                                <span style={{ borderBottom: `1px dotted ${ink}`, padding: '0 8px' }}>
                                    {`${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim() || '—'}
                                </span>{' '}
                                hereby acknowledge that I have received the above-mentioned assets. I understand that this
                                asset belongs to the company and is under my possession for carrying out my work. I hereby
                                assure that I will take care of the assets of the company to the possible extent. And if any
                                damage or loss, I am liable either to buy or willing to pay/get deducted from my salary.
                            </>
                        )}
                    </p>
                </section>

                {primaryAsset.acceptanceStatus === 'Accepted' ? (
                    <VitsSignatureBlock
                        title="Received and Acknowledged"
                        name={assigneeAcknowledgeName}
                        dateLabel={formatDate(primaryAsset.acceptedDate || actionDateRaw)}
                        signatureUrl={receivedSigUrl}
                    />
                ) : (
                    <VitsSignatureBlock
                        title="Received and Acknowledged"
                        name={assigneeAcknowledgeName !== '—' ? assigneeAcknowledgeName : ' '}
                        dateLabel="DD/MM/YYYY"
                        signatureUrl={null}
                    />
                )}
            </VitsLetterheadPage>
        </VitsLetterheadDocument>
    );
});

HandoverFormView.displayName = 'HandoverFormView';

export default HandoverFormView;
