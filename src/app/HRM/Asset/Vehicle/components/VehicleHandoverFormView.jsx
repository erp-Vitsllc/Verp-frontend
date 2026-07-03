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
    splitBodyConditionLayout,
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

    const bodyConditionLayout = useMemo(() => {
        if (!formData?.bodyConditionPairs?.length) {
            return { leadPair: null, pages: [] };
        }
        return splitBodyConditionLayout(formData.bodyConditionPairs);
    }, [formData]);

    if (!formData) return null;

    const { headerTable, accessories, officeUse, receiver, additionalInfo } = formData;
    const { leadPair: bodyConditionLeadPair, pages: bodyConditionPages } = bodyConditionLayout;
    const firstBodyChunk = bodyConditionPages[0] || [];
    const continuationBodyPages = bodyConditionPages.slice(1);
    const hasClosing = true;
    const closingOnLastBodyPage = hasClosing;
    const lastBodyPageIsPage3 = continuationBodyPages.length === 0;

    const containerClass = isPrint
        ? 'flex flex-col items-center gap-0'
        : 'mx-auto flex w-fit max-w-full flex-col items-center gap-4 py-2';

    return (
        <PdfRoot ref={ref} id="vehicle-handover-form-view" className={containerClass}>
            <VehicleHandoverPdfPageStyles />
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
                <VehicleHandoverPdfPage2
                    accessories={accessories}
                    bodyConditionLeadPair={bodyConditionLeadPair}
                    className="h-full"
                />
            </VehicleHandoverPdfPageFrame>

            <VehicleHandoverPdfPageFrame isLast={lastBodyPageIsPage3}>
                <VehicleHandoverPdfPage3
                    bodyConditionPairs={firstBodyChunk}
                    showClosingSection={closingOnLastBodyPage && lastBodyPageIsPage3}
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                    className="h-full"
                />
            </VehicleHandoverPdfPageFrame>

            {continuationBodyPages.map((pagePairs, index) => {
                const isLastBodyPage = index === continuationBodyPages.length - 1;

                return (
                    <VehicleHandoverPdfPageFrame key={`body-page-${index}`} isLast={isLastBodyPage}>
                        <VehicleHandoverPdfBodyConditionPage
                            pairs={pagePairs}
                            showClosingSection={closingOnLastBodyPage && isLastBodyPage}
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
