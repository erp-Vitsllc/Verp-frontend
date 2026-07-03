'use client';

import { PDF_INK, PDF_LINK } from '../utils/vehicleHandoverFormPdfConstants';

const PDF_CLOSING_LABEL_CLASS = 'text-[11pt] italic font-semibold';
const PDF_CLOSING_VALUE_CLASS = 'mt-1 min-h-[16px] text-[11pt] font-semibold';
const PDF_CLOSING_COLUMN_TITLE_CLASS = 'text-[11pt] italic font-semibold';

function PdfLink({ children, className = '' }) {
    return (
        <span className={className} style={{ color: PDF_LINK }}>
            {children}
        </span>
    );
}

function getSignatureUrl(sig) {
    if (!sig) return null;

    let url = null;
    if (typeof sig === 'string') {
        url = sig;
    } else if (typeof sig === 'object') {
        url =
            sig.url ||
            sig.data ||
            sig.path ||
            (typeof sig.signature === 'string'
                ? sig.signature
                : sig.signature?.url || sig.signature?.data) ||
            null;
    }

    if (!url || typeof url !== 'string' || url === 'undefined' || url === 'null' || url.includes('[object Object]')) {
        return null;
    }

    if (url.startsWith('data:') || url.startsWith('http')) return url;

    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
    const isUpload = normalizedPath.includes('uploads') || normalizedPath.includes('signatures');

    if (isUpload || !normalizedPath.startsWith('/assets')) {
        return `${apiBase}${normalizedPath}`.replace(/([^:]\/)\/+/g, '$1');
    }

    return normalizedPath;
}

function PdfBlueLabel({ children }) {
    return (
        <span className={PDF_CLOSING_LABEL_CLASS} style={{ color: PDF_INK }}>
            {children}
        </span>
    );
}

function ReceiverField({ label, value, signature }) {
    const isSignature = label.toLowerCase().includes('signature');
    const sigUrl = isSignature ? getSignatureUrl(signature) : null;
    const display = value && value !== '—' ? value : '';

    if (isSignature) {
        return (
            <div className="mb-2 text-[11pt]">
                <PdfBlueLabel>{label}</PdfBlueLabel>
                <div className="mt-1 min-h-[40px]">
                    {sigUrl ? (
                        <img
                            src={sigUrl}
                            alt="Signature"
                            crossOrigin="anonymous"
                            className="max-h-10 object-contain object-left"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-2 text-[11pt]">
            <PdfBlueLabel>{label}</PdfBlueLabel>
            <p className={PDF_CLOSING_VALUE_CLASS} style={{ color: PDF_INK }}>
                {display}
            </p>
        </div>
    );
}

function SignatureImage({ signature, alt }) {
    const sigUrl = getSignatureUrl(signature);
    if (!sigUrl) return null;

    return (
        <img
            src={sigUrl}
            alt={alt}
            crossOrigin="anonymous"
            className="max-h-10 object-contain object-left"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
            }}
        />
    );
}

function OfficeUseColumn({
    title,
    name,
    date,
    time,
    signature,
    fieldGap = 'mt-3',
    sigMinH = 'min-h-[40px]',
    titleGap = 'mb-3',
}) {
    const displayName = name && name !== '—' ? name : '';
    const displayDate = date && date !== '—' ? date : '';
    const displayTime = time && time !== '—' ? time : '';

    return (
        <div className="min-w-0 flex-1">
            <p className={`${titleGap} ${PDF_CLOSING_COLUMN_TITLE_CLASS}`} style={{ color: PDF_INK }}>
                {title}
            </p>

            <p className={PDF_CLOSING_LABEL_CLASS} style={{ color: PDF_INK }}>Name</p>
            <p className={PDF_CLOSING_VALUE_CLASS} style={{ color: PDF_INK }}>{displayName}</p>

            <p className={`${fieldGap} ${PDF_CLOSING_LABEL_CLASS}`} style={{ color: PDF_INK }}>Date</p>
            <p className={PDF_CLOSING_VALUE_CLASS} style={{ color: PDF_INK }}>{displayDate}</p>

            <p className={`${fieldGap} ${PDF_CLOSING_LABEL_CLASS}`} style={{ color: PDF_INK }}>Time</p>
            <p className={PDF_CLOSING_VALUE_CLASS} style={{ color: PDF_INK }}>{displayTime}</p>

            <p className={`${fieldGap} ${PDF_CLOSING_LABEL_CLASS}`} style={{ color: PDF_INK }}>Signature</p>
            <div className={`mt-1 ${sigMinH}`}>
                <SignatureImage signature={signature} alt={`${title} signature`} />
            </div>
        </div>
    );
}

export function VehicleHandoverPdfReceiverClosingSection({
    additionalInfo,
    receiver,
    className = '',
    dense = false,
}) {
    const spacing = dense ? 'mt-3' : 'mt-6';
    const blockGap = dense ? 'mb-2' : 'mb-4';
    const sectionGap = dense ? 'mb-3' : 'mb-5';

    return (
        <div className={`${spacing} ${className}`}>
            <p className={`${blockGap} text-[13pt]`}>
                Additional <PdfLink className="text-[13pt]">vehicle Information</PdfLink>
            </p>

            {additionalInfo ? (
                <p className={`${blockGap} text-[11pt] leading-relaxed`}>{additionalInfo}</p>
            ) : null}

            <p className={`${blockGap} text-[11pt] leading-[1.4]`}>
                I confirm that I have received the vehicle in the condition described above. I accept full
                responsibility for any additional damage that is not recorded in this handover report.
            </p>

            <p className={`${dense ? 'mb-2' : 'mb-3'} ${PDF_CLOSING_COLUMN_TITLE_CLASS}`} style={{ color: PDF_INK }}>
                Received the Vehicle bellow Condition
            </p>

            <div className={`${sectionGap} max-w-lg`}>
                <ReceiverField label="Name :" value={receiver?.name} />
                <ReceiverField
                    label="Signature :"
                    signature={receiver?.signature || receiver?.person?.signature}
                />
                <ReceiverField label="Date:" value={receiver?.date} />
                <ReceiverField label="Time:" value={receiver?.time} />
            </div>
        </div>
    );
}

export function VehicleHandoverPdfOfficeUseSection({
    officeUse,
    className = '',
    dense = false,
}) {
    const blockGap = dense ? 'mb-2' : 'mb-4';
    const officeGap = dense ? 'mb-3' : 'mb-6';
    const officeFieldGap = dense ? 'mt-2' : 'mt-3';
    const officeSigMinH = dense ? 'min-h-[32px]' : 'min-h-[40px]';
    const officeTitleGap = dense ? 'mb-2' : 'mb-3';

    return (
        <div className={className}>
            <p className={`${blockGap} ${PDF_CLOSING_COLUMN_TITLE_CLASS}`} style={{ color: PDF_INK }}>
                For Office Use Only :
            </p>

            <div className={`${officeGap} flex gap-4`}>
                <OfficeUseColumn
                    title="Prepared By"
                    name={officeUse?.preparedBy?.name}
                    date={officeUse?.preparedBy?.date}
                    time={officeUse?.preparedBy?.time}
                    signature={officeUse?.preparedBy?.signature}
                    fieldGap={officeFieldGap}
                    sigMinH={officeSigMinH}
                    titleGap={officeTitleGap}
                />
                <OfficeUseColumn
                    title="HOD Approval"
                    name={officeUse?.hod?.name}
                    date={officeUse?.hod?.date}
                    time={officeUse?.hod?.time}
                    signature={officeUse?.hod?.signature}
                    fieldGap={officeFieldGap}
                    sigMinH={officeSigMinH}
                    titleGap={officeTitleGap}
                />
                <OfficeUseColumn
                    title="HR Approval"
                    name={officeUse?.hr?.name}
                    date={officeUse?.hr?.date}
                    time={officeUse?.hr?.time}
                    signature={officeUse?.hr?.signature}
                    fieldGap={officeFieldGap}
                    sigMinH={officeSigMinH}
                    titleGap={officeTitleGap}
                />
            </div>

            <p className="text-center text-[10pt] font-semibold">
                ----------------------------------------------------END-------------------------------------------------------
            </p>
        </div>
    );
}

export default function VehicleHandoverPdfClosingSection({
    additionalInfo,
    receiver,
    officeUse,
    className = '',
    dense = false,
    section = 'full',
}) {
    const showReceiver = section === 'full' || section === 'receiver';
    const showOffice = section === 'full' || section === 'office';

    const safeOfficeUse = officeUse || {
        preparedBy: {},
        hod: {},
        hr: {},
    };

    return (
        <div className={`pb-[4mm] ${className}`}>
            {showReceiver ? (
                <VehicleHandoverPdfReceiverClosingSection
                    additionalInfo={additionalInfo}
                    receiver={receiver || {}}
                    dense={dense}
                />
            ) : null}
            {showOffice ? (
                <VehicleHandoverPdfOfficeUseSection
                    officeUse={safeOfficeUse}
                    dense={dense}
                />
            ) : null}
        </div>
    );
}
