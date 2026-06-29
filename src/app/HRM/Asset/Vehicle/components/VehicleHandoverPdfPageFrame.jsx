'use client';

import {
    PDF_A4_HEIGHT,
    PDF_A4_WIDTH,
    PDF_PAGE_PADDING_X,
    PDF_PAGE_PADDING_Y,
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
                padding: ${PDF_PAGE_PADDING_Y} ${PDF_PAGE_PADDING_X};
                background: #ffffff;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
                border: 1px solid rgba(0, 0, 0, 0.08);
            }

            .${PDF_PAGE_SURFACE_CLASS}__content {
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
