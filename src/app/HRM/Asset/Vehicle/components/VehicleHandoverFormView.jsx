'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    buildVehicleHandoverFormData,
} from '../utils/vehicleHandoverFormViewData';
import {
    mapIndexPagesToPairs,
    packMeasuredHeightsIntoPages,
    PDF_CONTENT_HEIGHT_PX,
    PDF_CONTENT_WIDTH_PX,
    waitForPdfMeasureImages,
} from '../utils/vehicleHandoverPdfBodyPagination';
import { PdfRoot } from './VehicleHandoverPdfParts';
import VehicleHandoverPdfPage1 from './VehicleHandoverPdfPage1';
import VehicleHandoverPdfPage2 from './VehicleHandoverPdfPage2';
import VehicleHandoverPdfPage3 from './VehicleHandoverPdfPage3';
import VehicleHandoverPdfBodyConditionPage, {
    PdfBodyConditionTable,
    PDF_BODY_PHOTO_HEIGHT,
} from './VehicleHandoverPdfBodyConditionPage';
import VehicleHandoverPdfClosingSection from './VehicleHandoverPdfClosingSection';
import VehicleHandoverPdfPageFrame, { VehicleHandoverPdfPageStyles } from './VehicleHandoverPdfPageFrame';
import { PDF_LETTERHEAD_BG_URL } from '../utils/vehicleHandoverFormPdfConstants';

function buildFallbackBodyLayout(pairs) {
    if (!pairs?.length) {
        return {
            leadPair: null,
            pages: [],
            closingAlone: true,
            ready: true,
        };
    }

    // Conservative fallback before measurement: one lead on accessories page, then 3 rows/page.
    const leadPair = pairs[0];
    const rest = pairs.slice(1);
    const pages = [];
    for (let i = 0; i < rest.length; i += 3) {
        pages.push(rest.slice(i, i + 3));
    }
    return {
        leadPair,
        pages,
        closingAlone: false,
        ready: false,
    };
}

const VehicleHandoverFormView = React.forwardRef(function VehicleHandoverFormView(
    { historyEntry, vehicle, isPrint = false },
    ref,
) {
    const formData = useMemo(
        () => buildVehicleHandoverFormData(historyEntry, vehicle),
        [historyEntry, vehicle],
    );

    const pairs = formData?.bodyConditionPairs || [];
    const [bodyLayout, setBodyLayout] = useState(() => buildFallbackBodyLayout(pairs));
    const measureRootRef = useRef(null);
    const page2MeasureRef = useRef(null);
    const closingMeasureRef = useRef(null);
    const measureTokenRef = useRef(0);

    useEffect(() => {
        setBodyLayout(buildFallbackBodyLayout(pairs));
    }, [pairs]);

    useLayoutEffect(() => {
        if (!formData) return undefined;

        const token = ++measureTokenRef.current;
        let cancelled = false;

        const run = async () => {
            const root = measureRootRef.current;
            if (!root) return;

            await waitForPdfMeasureImages(root);
            // Allow comment text / images to settle one frame.
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            if (cancelled || token !== measureTokenRef.current) return;

            const availableHeight = PDF_CONTENT_HEIGHT_PX;
            const page2Height = Math.ceil(page2MeasureRef.current?.getBoundingClientRect().height || 0);
            const closingHeight = Math.ceil(closingMeasureRef.current?.getBoundingClientRect().height || 0);
            const rowNodes = Array.from(root.querySelectorAll('[data-pdf-measure-pair]'));
            const pairHeights = rowNodes.map((node) =>
                Math.ceil(node.getBoundingClientRect().height || 0),
            );

            if (!pairs.length) {
                setBodyLayout({
                    leadPair: null,
                    pages: [],
                    closingAlone: true,
                    ready: true,
                });
                return;
            }

            let leadPair = null;
            let remainingPairs = pairs;
            let remainingHeights = pairHeights;

            const leadHeight = pairHeights[0] || 0;
            const leadGap = 12;
            const remainingOnPage2 = availableHeight - page2Height - leadGap;
            if (leadHeight > 0 && remainingOnPage2 >= leadHeight) {
                leadPair = pairs[0];
                remainingPairs = pairs.slice(1);
                remainingHeights = pairHeights.slice(1);
            }

            const packed = packMeasuredHeightsIntoPages(remainingHeights, availableHeight, {
                trailingHeight: closingHeight,
            });
            const pages = mapIndexPagesToPairs(remainingPairs, packed.pages);

            setBodyLayout({
                leadPair,
                pages,
                closingAlone: packed.closingAlone || pages.length === 0,
                ready: true,
            });
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [formData, pairs]);

    if (!formData) return null;

    const { headerTable, accessories, officeUse, receiver, additionalInfo } = formData;
    const { leadPair: bodyConditionLeadPair, pages: bodyConditionPages, closingAlone } = bodyLayout;
    const firstBodyChunk = bodyConditionPages[0] || [];
    const continuationBodyPages = bodyConditionPages.slice(1);
    const hasBodyPages = bodyConditionPages.length > 0;
    const lastBodyPageIsPage3 = hasBodyPages && continuationBodyPages.length === 0;
    const showClosingOnPage3 = hasBodyPages && lastBodyPageIsPage3 && !closingAlone;
    const showClosingOnLastContinuation =
        hasBodyPages && !lastBodyPageIsPage3 && !closingAlone;
    const showClosingOnlyPage = closingAlone || !hasBodyPages;

    const containerClass = isPrint
        ? 'flex flex-col items-center gap-0'
        : 'mx-auto flex w-fit max-w-full flex-col items-center gap-4 py-2';

    return (
        <PdfRoot
            ref={ref}
            id="vehicle-handover-form-view"
            className={containerClass}
            data-pdf-pagination-ready={bodyLayout.ready ? 'true' : 'false'}
        >
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
                    :global(.pdf-body-condition-row) {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* Off-screen measure layer — same content width as the printable area */}
            <div
                ref={measureRootRef}
                aria-hidden
                className="pointer-events-none absolute left-[-12000px] top-0 overflow-hidden opacity-0"
                style={{ width: PDF_CONTENT_WIDTH_PX }}
            >
                <div ref={page2MeasureRef}>
                    <VehicleHandoverPdfPage2 accessories={accessories} bodyConditionLeadPair={null} />
                </div>
                {pairs.map((pair) => (
                    <div
                        key={`measure-${pair.left.key}-${pair.right.key}`}
                        data-pdf-measure-pair={`${pair.left.key}-${pair.right.key}`}
                        className="mb-0"
                    >
                        <PdfBodyConditionTable pairs={[pair]} photoHeight={PDF_BODY_PHOTO_HEIGHT} />
                    </div>
                ))}
                <div ref={closingMeasureRef}>
                    <VehicleHandoverPdfClosingSection
                        additionalInfo={additionalInfo}
                        receiver={receiver}
                        officeUse={officeUse}
                        dense
                    />
                </div>
            </div>

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

            {hasBodyPages ? (
                <VehicleHandoverPdfPageFrame isLast={lastBodyPageIsPage3 && !showClosingOnlyPage}>
                    <VehicleHandoverPdfPage3
                        bodyConditionPairs={firstBodyChunk}
                        showClosingSection={showClosingOnPage3}
                        additionalInfo={additionalInfo}
                        receiver={receiver}
                        officeUse={officeUse}
                        className="h-full"
                    />
                </VehicleHandoverPdfPageFrame>
            ) : null}

            {continuationBodyPages.map((pagePairs, index) => {
                const isLastBodyPage = index === continuationBodyPages.length - 1;
                const showClosing = showClosingOnLastContinuation && isLastBodyPage;

                return (
                    <VehicleHandoverPdfPageFrame
                        key={`body-page-${index}`}
                        isLast={isLastBodyPage && !showClosingOnlyPage}
                    >
                        <VehicleHandoverPdfBodyConditionPage
                            pairs={pagePairs}
                            showClosingSection={showClosing}
                            additionalInfo={additionalInfo}
                            receiver={receiver}
                            officeUse={officeUse}
                            className="h-full"
                        />
                    </VehicleHandoverPdfPageFrame>
                );
            })}

            {showClosingOnlyPage ? (
                <VehicleHandoverPdfPageFrame isLast>
                    <VehicleHandoverPdfBodyConditionPage
                        pairs={[]}
                        showClosingSection
                        additionalInfo={additionalInfo}
                        receiver={receiver}
                        officeUse={officeUse}
                        className="h-full"
                    />
                </VehicleHandoverPdfPageFrame>
            ) : null}
        </PdfRoot>
    );
});

VehicleHandoverFormView.displayName = 'VehicleHandoverFormView';

export default VehicleHandoverFormView;
