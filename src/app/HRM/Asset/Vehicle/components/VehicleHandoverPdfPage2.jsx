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

function SignatureBlock({ heading, name, signature, date }) {
    const sigUrl = getSignatureUrl(signature);
    const displayName = name && name !== '—' ? name : '';
    const displayDate = date && date !== '—' ? date : '';

    return (
        <div className="min-w-0 flex-1">
            <p className="text-[11pt] italic">{heading}</p>

            <p className="mt-4 text-[11pt] italic">Name</p>
            <p className="mt-1 min-h-[20px] text-[11pt] not-italic">{displayName}</p>

            <p className="mt-4 text-[11pt] italic">Signature</p>
            <div className="mt-1 flex min-h-[40px] items-end">
                {sigUrl ? (
                    <img
                        src={sigUrl}
                        alt={`${heading} signature`}
                        className="max-h-12 max-w-[180px] object-contain object-left"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : null}
            </div>

            <p className="mt-4 text-[11pt] italic">Date</p>
            <p className="mt-1 min-h-[20px] text-[11pt] not-italic">{displayDate}</p>
        </div>
    );
}

export default function VehicleHandoverPdfPage2({ signatures, className = '' }) {
    return (
        <div className={`${PDF_PAGE1_CLASS} ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <p className="text-[11pt] font-bold leading-[1.45]">
                By signing below, I acknowledge that I have read, understood, and agree to comply with the terms and
                conditions outlined in the policy.
            </p>

            <p className="mt-3 text-[11pt] italic leading-[1.45] underline">
                <span style={{ color: PDF_LINK }} className="underline">Important Note</span>
                {' '}
                : -Please be advised that if evidence of any scratches or damages is not provided during the handover
                process, and such damages are not recorded in our previous handover history, the current damages will
                be attributed to your responsibility. Therefore, we strongly recommend updating the vehicle condition
                thoroughly during the handover. ensure a smooth and transparent vehicle handover or takeover process,
                please provide photos of the car from all sides, both exterior and interior, at the time of handover.
                Kindly mark all relevant details in the vehicle condition report.
            </p>

            <div className="mt-6 flex gap-10">
                <SignatureBlock
                    heading="Hand Over by"
                    name={signatures.handoverByName}
                    signature={
                        signatures.handoverBySignature || signatures.handoverByPerson?.signature
                    }
                    date={signatures.handoverDate}
                />
                <SignatureBlock
                    heading="Received the Vehicle bellow Condition"
                    name={signatures.handoverToName}
                    signature={
                        signatures.handoverToSignature || signatures.handoverToPerson?.signature
                    }
                    date={signatures.receiverDate}
                />
            </div>
        </div>
    );
}
