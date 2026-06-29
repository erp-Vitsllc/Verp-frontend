'use client';

import { PDF_LINK, PDF_PAGE1_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';

function PdfLink({ children }) {
    return (
        <span className="underline" style={{ color: PDF_LINK }}>
            {children}
        </span>
    );
}

export default function VehicleHandoverPdfAdditionalInfoPage({ additionalInfo, className = '' }) {
    return (
        <div className={`${PDF_PAGE1_CLASS} h-full ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <p className="mb-4 text-[11pt]">
                Additional <PdfLink>vehicle Information</PdfLink>
            </p>
            <div className="min-h-[80px] text-[11pt] leading-relaxed">
                {additionalInfo || ''}
            </div>
        </div>
    );
}
