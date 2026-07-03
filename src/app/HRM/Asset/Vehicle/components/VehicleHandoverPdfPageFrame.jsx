'use client';

import {
    PDF_A4_HEIGHT,
    PDF_A4_WIDTH,
    PDF_LETTERHEAD_BG_URL,
    PDF_PAGE_PADDING_BOTTOM,
    PDF_PAGE_PADDING_TOP,
    PDF_PAGE_PADDING_X,
    PDF_PAGE_SURFACE_CLASS,
    PDF_PAGE_SURFACE_COMPACT_CLASS,
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
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
                border: 1px solid rgba(0, 0, 0, 0.08);
                position: relative;
            }

            .${PDF_PAGE_SURFACE_CLASS}__letterhead {
                position: absolute;
                inset: 0;
                z-index: 0;
                width: 100%;
                height: 100%;
                object-fit: fill;
                pointer-events: none;
                user-select: none;
            }

            .${PDF_PAGE_SURFACE_COMPACT_CLASS} {
                height: auto;
                min-height: 0;
                overflow: visible;
            }

            .${PDF_PAGE_SURFACE_CLASS}__content {
                position: relative;
                z-index: 1;
                height: 100%;
                min-height: 0;
                overflow: visible;
            }

            .${PDF_PAGE_SURFACE_COMPACT_CLASS} .${PDF_PAGE_SURFACE_CLASS}__content {
                height: auto;
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

                .${PDF_PAGE_SURFACE_COMPACT_CLASS} {
                    height: auto;
                    page-break-inside: avoid;
                    break-inside: avoid;
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

export default function VehicleHandoverPdfPageFrame({ children, isLast = false, compact = false }) {
    const classes = [
        PDF_PAGE_SURFACE_CLASS,
        compact ? PDF_PAGE_SURFACE_COMPACT_CLASS : '',
        isLast ? `${PDF_PAGE_SURFACE_CLASS}--last` : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes}>
            <img
                src={PDF_LETTERHEAD_BG_URL}
                alt=""
                aria-hidden
                className={`${PDF_PAGE_SURFACE_CLASS}__letterhead`}
                data-pdf-letterhead="true"
            />
            <div className={`${PDF_PAGE_SURFACE_CLASS}__content`}>{children}</div>
        </div>
    );
}
