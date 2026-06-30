'use client';

import React, { useMemo } from 'react';
import {
    buildVehicleHandoverFormData,
} from '../utils/vehicleHandoverFormViewData';
import { PdfRoot } from './VehicleHandoverPdfParts';
import VehicleHandoverPdfPage1 from './VehicleHandoverPdfPage1';
import VehicleHandoverPdfPage2 from './VehicleHandoverPdfPage2';
import VehicleHandoverPdfPage3 from './VehicleHandoverPdfPage3';
import VehicleHandoverPdfBodyConditionPage, {
    chunkBodyConditionPages,
    PDF_BODY_ROWS_ON_ACCESSORIES_PAGE,
} from './VehicleHandoverPdfBodyConditionPage';
import VehicleHandoverPdfPageFrame, { VehicleHandoverPdfPageStyles } from './VehicleHandoverPdfPageFrame';
import { PDF_LETTERHEAD_BG_URL } from '../utils/vehicleHandoverFormPdfConstants';

const VehicleHandoverFormView = React.forwardRef(function VehicleHandoverFormView(
    { historyEntry, vehicle, isPrint = false },
    ref,
) {
    const formData = useMemo(
        () => buildVehicleHandoverFormData(historyEntry, vehicle),
        [historyEntry, vehicle],
    );

    const bodyConditionOnAccessoriesPage = useMemo(() => {
        if (!formData?.bodyConditionPairs?.length) return [];
        return formData.bodyConditionPairs.slice(0, PDF_BODY_ROWS_ON_ACCESSORIES_PAGE);
    }, [formData]);

    const bodyConditionPages = useMemo(() => {
        if (!formData?.bodyConditionPairs?.length) return [];
        return chunkBodyConditionPages(
            formData.bodyConditionPairs,
            undefined,
            PDF_BODY_ROWS_ON_ACCESSORIES_PAGE,
        );
    }, [formData]);

    if (!formData) return null;

    const { headerTable, signatures, accessories, officeUse, receiver, additionalInfo } =
        formData;

    const containerClass = isPrint
        ? 'flex flex-col items-center gap-0'
        : 'mx-auto flex w-fit max-w-full flex-col items-center gap-8 py-2';

    return (
        <PdfRoot ref={ref} id="vehicle-handover-form-view" className={containerClass}>
            <VehicleHandoverPdfPageStyles />
            {/* Preload letterhead so Puppeteer / html2canvas paint backgrounds before capture */}
            <img
                src={PDF_LETTERHEAD_BG_URL}
                alt=""
                aria-hidden
                className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
            />
            <style jsx>{`
                @media print {
                    div {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <VehicleHandoverPdfPageFrame>
                <VehicleHandoverPdfPage1 headerTable={headerTable} className="h-full" />
            </VehicleHandoverPdfPageFrame>

            <VehicleHandoverPdfPageFrame>
                <VehicleHandoverPdfPage2 signatures={signatures} className="h-full" />
            </VehicleHandoverPdfPageFrame>

            <VehicleHandoverPdfPageFrame
                isLast={bodyConditionPages.length === 0}
            >
                <VehicleHandoverPdfPage3
                    accessories={accessories}
                    bodyConditionPairs={bodyConditionOnAccessoriesPage}
                    showClosingSection={bodyConditionPages.length === 0}
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                    className="h-full"
                />
            </VehicleHandoverPdfPageFrame>

            {bodyConditionPages.map((pagePairs, index) => {
                const isLastBodyPage = index === bodyConditionPages.length - 1;

                return (
                    <VehicleHandoverPdfPageFrame
                        key={`body-page-${index}`}
                        isLast={isLastBodyPage}
                    >
                        <VehicleHandoverPdfBodyConditionPage
                            pairs={pagePairs}
                            showClosingSection={isLastBodyPage}
                            additionalInfo={additionalInfo}
                            receiver={receiver}
                            officeUse={officeUse}
                            className="h-full"
                        />
                    </VehicleHandoverPdfPageFrame>
                );
            })}
        </PdfRoot>
    );
});

VehicleHandoverFormView.displayName = 'VehicleHandoverFormView';

export default VehicleHandoverFormView;
