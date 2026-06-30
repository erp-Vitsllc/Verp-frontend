'use client';

import {
    PDF_A4_HEIGHT,
    PDF_A4_WIDTH,
    PDF_LETTERHEAD_BG_URL,
    PDF_PAGE_PADDING_BOTTOM,
    PDF_PAGE_PADDING_TOP,
    PDF_PAGE_PADDING_X,
    PDF_PAGE_SURFACE_CLASS,
} from '../utils/vehicleHandoverFormPdfConstants';

export function VehicleHandoverPdfPageStyles() {
    return (
        <style jsx global>{`
            @page {
                size: A4;
                margin: 0;
            }

            .${PDF_PAGE_SURFACE_CLASS} {
                box-sizing: border-box;
                width: ${PDF_A4_WIDTH};
                height: ${PDF_A4_HEIGHT};
                flex-shrink: 0;
                padding: ${PDF_PAGE_PADDING_TOP} ${PDF_PAGE_PADDING_X} ${PDF_PAGE_PADDING_BOTTOM};
                background-color: #ffffff;
                background-image: url('${PDF_LETTERHEAD_BG_URL}');
                background-size: 100% 100%;
                background-position: center;
                background-repeat: no-repeat;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
                border: 1px solid rgba(0, 0, 0, 0.08);
                position: relative;
            }

            .${PDF_PAGE_SURFACE_CLASS}__content {
                position: relative;
                z-index: 1;
                height: 100%;
                min-height: 0;
                overflow: hidden;
            }

            @media print {
                .${PDF_PAGE_SURFACE_CLASS} {
                    box-shadow: none;
                    border: none;
                    margin: 0 !important;
                    overflow: visible;
                    page-break-after: always;
                    break-after: page;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .${PDF_PAGE_SURFACE_CLASS}--last {
                    page-break-after: auto;
                    break-after: auto;
                }
            }
        `}</style>
    );
}

export default function VehicleHandoverPdfPageFrame({ children, isLast = false }) {
    return (
        <div
            className={`${PDF_PAGE_SURFACE_CLASS} ${isLast ? `${PDF_PAGE_SURFACE_CLASS}--last` : ''}`}
        >
            <div className={`${PDF_PAGE_SURFACE_CLASS}__content`}>{children}</div>
        </div>
    );
}
