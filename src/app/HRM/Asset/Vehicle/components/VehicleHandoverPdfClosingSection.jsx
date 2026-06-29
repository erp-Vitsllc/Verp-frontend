'use client';

import { PDF_LINK } from '../utils/vehicleHandoverFormPdfConstants';

function PdfLink({ children, className = '' }) {
    return (
        <span className={`underline ${className}`} style={{ color: PDF_LINK }}>
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
        <span className="italic underline" style={{ color: PDF_LINK }}>
            {children}
        </span>
    );
}

function ReceiverField({ label, value, signature }) {
    const sigUrl = label.toLowerCase().includes('signature') ? getSignatureUrl(signature) : null;
    const display = value && value !== '—' ? value : '';

    return (
        <div className="mb-2 flex gap-2 text-[11pt]">
            <PdfBlueLabel>{label}</PdfBlueLabel>
            {sigUrl ? (
                <img
                    src={sigUrl}
                    alt="Signature"
                    className="max-h-9 object-contain object-left"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                <span>{display}</span>
            )}
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
            className="max-h-10 object-contain object-left"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
            }}
        />
    );
}

function OfficeUseColumn({ title, name, date, time, signature }) {
    const displayName = name && name !== '—' ? name : '';
    const displayDate = date && date !== '—' ? date : '';
    const displayTime = time && time !== '—' ? time : '';

    return (
        <div className="min-w-0 flex-1">
            <p className="mb-3 text-[11pt] italic">{title}</p>

            <p className="text-[11pt] italic">Name</p>
            <p className="mt-1 min-h-[16px] text-[11pt]">{displayName}</p>

            <p className="mt-3 text-[11pt] italic">Date</p>
            <p className="mt-1 min-h-[16px] text-[11pt]">{displayDate}</p>

            <p className="mt-3 text-[11pt] italic">Time</p>
            <p className="mt-1 min-h-[16px] text-[11pt]">{displayTime}</p>

            <p className="mt-3 text-[11pt] italic">Signature</p>
            <div className="mt-1 min-h-[36px]">
                <SignatureImage signature={signature} alt={`${title} signature`} />
            </div>
        </div>
    );
}

export default function VehicleHandoverPdfClosingSection({
    additionalInfo,
    receiver,
    officeUse,
    className = '',
}) {
    return (
        <div className={`mt-6 ${className}`}>
            <p className="mb-2 text-[13pt]">
                Additional <PdfLink className="text-[13pt]">vehicle Information</PdfLink>
            </p>

            {additionalInfo ? (
                <p className="mb-4 text-[11pt] leading-relaxed">{additionalInfo}</p>
            ) : null}

            <p className="mb-4 text-[11pt] leading-[1.4]">
                I confirm that I have received the vehicle in the condition described above. I accept full
                responsibility for any additional damage that is not recorded in this handover report.
            </p>

            <p className="mb-3 text-[11pt] italic">Received the Vehicle bellow Condition</p>

            <div className="mb-5 max-w-lg">
                <ReceiverField label="Name :" value={receiver.name} />
                <ReceiverField
                    label="Signature :"
                    signature={receiver.signature || receiver.person?.signature}
                />
                <ReceiverField label="Date:" value={receiver.date} />
                <ReceiverField label="Time:" value={receiver.time} />
            </div>

            <p className="mb-4 text-[11pt] font-bold italic underline">For Office Use Only :</p>

            <div className="mb-6 flex gap-6">
                <OfficeUseColumn
                    title="Prepared By"
                    name={officeUse.preparedBy.name}
                    date={officeUse.preparedBy.date}
                    time={officeUse.preparedBy.time}
                    signature={officeUse.preparedBy.signature}
                />
                <OfficeUseColumn
                    title="HOD Approval"
                    name={officeUse.hod.name}
                    date={officeUse.hod.date}
                    time={officeUse.hod.time}
                    signature={officeUse.hod.signature}
                />
                <OfficeUseColumn
                    title="HR Approval"
                    name={officeUse.hr.name}
                    date={officeUse.hr.date}
                    time={officeUse.hr.time}
                    signature={officeUse.hr.signature}
                />
            </div>

            <p className="text-center text-[10pt] font-bold">
                ----------------------------------------------------END-------------------------------------------------------
            </p>
        </div>
    );
}
