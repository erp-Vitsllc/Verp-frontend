'use client';

import { PDF_LINK, PDF_PAGE1_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';

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
    const sigUrl = getSignatureUrl(signature);
    const display = value && value !== '—' ? value : '';

    return (
        <div className="mb-5 flex items-end gap-1 text-[11pt]">
            <PdfBlueLabel>{label}</PdfBlueLabel>
            <span className="min-h-[20px] flex-1 border-b border-dashed border-black pb-0.5">
                {sigUrl ? (
                    <img
                        src={sigUrl}
                        alt="Signature"
                        className="max-h-10 object-contain object-left"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : (
                    display
                )}
            </span>
        </div>
    );
}

function OfficeUseColumn({ title, name, date, time }) {
    const displayName = name && name !== '—' ? name : '';
    const displayDate = date && date !== '—' ? date : '';
    const displayTime = time && time !== '—' ? time : '';

    return (
        <div className="min-w-0 flex-1">
            <p className="mb-8 text-[11pt] italic">{title}</p>

            <p className="text-[11pt] italic">Name</p>
            <p className="mt-2 min-h-[20px] text-[11pt]">{displayName}</p>

            <p className="mt-5 text-[11pt] italic">Date</p>
            <p className="mt-2 min-h-[20px] text-[11pt]">{displayDate}</p>

            <p className="mt-5 text-[11pt] italic">Time</p>
            <p className="mt-2 min-h-[20px] text-[11pt]">{displayTime}</p>

            <p className="mt-5 text-[11pt] italic">Signature</p>
            <div className="mt-2 min-h-[40px] border-b border-dashed border-black" />
        </div>
    );
}

export default function VehicleHandoverPdfPage6({ receiver, officeUse, className = '' }) {
    return (
        <div className={`${PDF_PAGE1_CLASS} flex h-full flex-col ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <p className="mb-8 text-[11pt] leading-[1.45]">
                I confirm that I have received the vehicle in the condition described above. I accept full
                responsibility for any additional damage that is not recorded in this handover report.
            </p>

            <p className="mb-6 text-[11pt] italic">Received the Vehicle bellow Condition</p>

            <div className="mb-10 max-w-lg">
                <ReceiverField label="Name :" value={receiver.name} />
                <ReceiverField label="Signature :" signature={receiver.person?.signature} />
                <ReceiverField label="Date:" value={receiver.date} />
                <ReceiverField label="Time:" value={receiver.time} />
            </div>

            <p className="mb-8 text-[11pt] font-bold italic underline">For Office Use Only :</p>

            <div className="mb-12 flex gap-8">
                <OfficeUseColumn
                    title="Prepared By"
                    name={officeUse.preparedBy.name}
                    date={officeUse.preparedBy.date}
                    time={officeUse.preparedBy.time}
                />
                <OfficeUseColumn
                    title="HR Approval"
                    name={officeUse.hr.name}
                    date={officeUse.hr.date}
                    time={officeUse.hr.time}
                />
            </div>

            <p className="mt-auto text-center text-[10pt] font-bold">
                ----------------------------------------------------END-------------------------------------------------------
            </p>
        </div>
    );
}
