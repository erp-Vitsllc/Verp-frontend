'use client';

import { PDF_DOCUMENT_TITLE_CLASS } from '../utils/vehicleHandoverFormPdfConstants';

export function VehicleHandoverPolicyTitle({ className = 'mb-10' }) {
    return (
        <h1 className={`${PDF_DOCUMENT_TITLE_CLASS} ${className}`}>
            Vehicle hand over{' '}
            <span className="underline [font-size:inherit] [font-weight:inherit]">Document and</span>
            {' '}Usage Policy
        </h1>
    );
}

export function VehicleHandoverAssessmentTitle({ className = 'mb-3' }) {
    return (
        <h1 className={`${PDF_DOCUMENT_TITLE_CLASS} ${className}`}>
            Vehicle assessment report By Receiver
        </h1>
    );
}
