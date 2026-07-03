'use client';

import { PDF_LINK, PDF_PAGE1_CLASS, PDF_SECTION_EMPHASIS_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';
import { PdfAccessoriesTable } from './VehicleHandoverPdfAccessoriesTable';
import { PdfBodyConditionTable, PDF_ACCESSORY_PHOTO_HEIGHT, PDF_BODY_LEAD_PHOTO_HEIGHT } from './VehicleHandoverPdfBodyConditionPage';
import { VehicleHandoverAssessmentTitle } from './VehicleHandoverPdfTitles';

export default function VehicleHandoverPdfPage2({
    accessories = [],
    bodyConditionLeadPair = null,
    className = '',
}) {
    return (
        <div className={`${PDF_PAGE1_CLASS} ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <p className={`text-[11pt] leading-[1.45] ${PDF_SECTION_EMPHASIS_CLASS}`}>
                By signing below, I acknowledge that I have read, understood, and agree to comply with the terms and
                conditions outlined in the policy.
            </p>

            <p className="mt-3 text-[11pt] italic leading-[1.45]">
                <span style={{ color: PDF_LINK }} className={PDF_SECTION_EMPHASIS_CLASS}>Important Note</span>
                {' '}
                : -Please be advised that if evidence of any scratches or damages is not provided during the handover
                process, and such damages are not recorded in our previous handover history, the current damages will
                be attributed to your responsibility. Therefore, we strongly recommend updating the vehicle condition
                thoroughly during the handover. ensure a smooth and transparent vehicle handover or takeover process,
                please provide photos of the car from all sides, both exterior and interior, at the time of handover.
                Kindly mark all relevant details in the vehicle condition report.
            </p>

            <div className="mt-5">
                <VehicleHandoverAssessmentTitle className="mb-3" />
                <PdfAccessoriesTable
                    rows={accessories}
                    photoHeight={PDF_ACCESSORY_PHOTO_HEIGHT}
                />
            </div>

            {bodyConditionLeadPair ? (
                <div className="mt-3 mb-[6mm]">
                    <PdfBodyConditionTable
                        pairs={[bodyConditionLeadPair]}
                        showTitleRow
                        photoHeight={PDF_BODY_LEAD_PHOTO_HEIGHT}
                    />
                </div>
            ) : null}
        </div>
    );
}
