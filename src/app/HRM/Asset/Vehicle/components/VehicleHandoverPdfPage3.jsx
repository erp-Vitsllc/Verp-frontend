'use client';

import { PDF_PAGE1_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';
import { PdfBodyConditionTable, resolveBodyPhotoHeight } from './VehicleHandoverPdfBodyConditionPage';
import VehicleHandoverPdfClosingSection from './VehicleHandoverPdfClosingSection';

export default function VehicleHandoverPdfPage3({
    bodyConditionPairs = [],
    showClosingSection = false,
    additionalInfo = '',
    receiver,
    officeUse,
    className = '',
}) {
    const photoHeight = resolveBodyPhotoHeight(bodyConditionPairs.length, showClosingSection);

    return (
        <div className={`${PDF_PAGE1_CLASS} h-full ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            {bodyConditionPairs.length > 0 ? (
                <PdfBodyConditionTable
                    pairs={bodyConditionPairs}
                    photoHeight={photoHeight}
                />
            ) : null}

            {showClosingSection ? (
                <VehicleHandoverPdfClosingSection
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                    dense
                />
            ) : null}
        </div>
    );
}
