'use client';

import {
    VITS_LETTERHEAD_BG_URL,
    VITS_PDF_A4_HEIGHT,
    VITS_PDF_A4_WIDTH,
    VITS_PDF_CONTENT_CLASS,
    VITS_PDF_FONT_BOLD_URL,
    VITS_PDF_FONT_FAMILY,
    VITS_PDF_FONT_ITALIC_URL,
    VITS_PDF_FONT_REGULAR_URL,
    VITS_PDF_LETTERHEAD_CLASS,
    VITS_PDF_PAGE_CLASS,
    VITS_PDF_ROOT_CLASS,
    VITS_PDF_SAFE_BOTTOM,
    VITS_PDF_SAFE_TOP,
    VITS_PDF_SAFE_X,
} from './constants';

/**
 * Global styles: true A4 pages stacked so Puppeteer/print always paginate
 * with a fresh VITS letterhead on every page (including continuation).
 */
export function VitsLetterheadPageStyles() {
    return (
        <style>{`
            @font-face {
                font-family: 'Times New Roman';
                src: url('${VITS_PDF_FONT_REGULAR_URL}') format('truetype');
                font-weight: 400;
                font-style: normal;
                font-display: block;
            }
            @font-face {
                font-family: 'Times New Roman';
                src: url('${VITS_PDF_FONT_BOLD_URL}') format('truetype');
                font-weight: 700;
                font-style: normal;
                font-display: block;
            }
            @font-face {
                font-family: 'Times New Roman';
                src: url('${VITS_PDF_FONT_ITALIC_URL}') format('truetype');
                font-weight: 400;
                font-style: italic;
                font-display: block;
            }

            @page {
                size: A4 portrait;
                margin: 0;
            }

            .${VITS_PDF_ROOT_CLASS},
            .${VITS_PDF_ROOT_CLASS} * {
                font-family: ${VITS_PDF_FONT_FAMILY} !important;
                font-size: 12pt !important;
                font-weight: 500 !important;
                font-style: normal !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
            }

            .${VITS_PDF_ROOT_CLASS} .vits-doc-title {
                font-size: 18pt !important;
                font-weight: 700 !important;
                text-decoration: underline !important;
                text-underline-offset: 4px !important;
                border-bottom: none !important;
                padding-bottom: 0 !important;
                display: inline-block !important;
                width: auto !important;
            }

            .${VITS_PDF_ROOT_CLASS} .vits-sig-label,
            .${VITS_PDF_ROOT_CLASS} .vits-sig-label * {
                font-size: 10pt !important;
                font-weight: 500 !important;
            }

            .${VITS_PDF_ROOT_CLASS} {
                width: ${VITS_PDF_A4_WIDTH};
                margin: 0 auto;
                background: transparent;
                color: #1a1a1a;
                line-height: 1.35;
            }

            .${VITS_PDF_PAGE_CLASS} {
                position: relative;
                width: ${VITS_PDF_A4_WIDTH};
                height: ${VITS_PDF_A4_HEIGHT};
                min-height: ${VITS_PDF_A4_HEIGHT};
                max-height: ${VITS_PDF_A4_HEIGHT};
                margin: 0;
                padding: ${VITS_PDF_SAFE_TOP} ${VITS_PDF_SAFE_X} ${VITS_PDF_SAFE_BOTTOM};
                background: #ffffff;
                overflow: hidden;
                /* Hard sheet break — each frame is its own A4 page */
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid;
                break-inside: avoid;
                /* Screen preview: look like separate paper sheets */
                box-shadow: 0 2px 14px rgba(0, 0, 0, 0.14);
                border: 1px solid #d1d5db;
            }

            /* Clear gap between sheets in on-screen preview */
            .${VITS_PDF_PAGE_CLASS} + .${VITS_PDF_PAGE_CLASS} {
                margin-top: 20px;
                page-break-before: always;
                break-before: page;
            }

            .${VITS_PDF_PAGE_CLASS}--last {
                page-break-after: auto;
                break-after: auto;
            }

            .${VITS_PDF_LETTERHEAD_CLASS} {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                z-index: 0;
                pointer-events: none;
                user-select: none;
                overflow: hidden;
            }

            .${VITS_PDF_LETTERHEAD_CLASS} img {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: fill;
                object-position: center top;
            }

            .${VITS_PDF_CONTENT_CLASS} {
                position: relative;
                z-index: 1;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            /*
             * Direct child of the PAGE sheet — pinned left, just above footer rule.
             */
            .${VITS_PDF_PAGE_CLASS} > .vits-doc-generated {
                position: absolute !important;
                left: ${VITS_PDF_SAFE_X} !important;
                right: auto !important;
                bottom: 30mm !important;
                width: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                text-align: left !important;
                color: #4b5563 !important;
                z-index: 3;
                font-size: 12pt !important;
                font-weight: 500 !important;
            }

            .${VITS_PDF_ROOT_CLASS} .vits-declaration {
                border: none !important;
                box-shadow: none !important;
            }

            .${VITS_PDF_ROOT_CLASS} table,
            .${VITS_PDF_ROOT_CLASS} th,
            .${VITS_PDF_ROOT_CLASS} td {
                background: transparent !important;
                background-color: transparent !important;
            }

            .${VITS_PDF_ROOT_CLASS} .vits-section-title {
                font-size: 13pt !important;
                font-weight: 700 !important;
                text-decoration: underline !important;
                text-underline-offset: 3px !important;
                border-bottom: none !important;
                padding-bottom: 0 !important;
                margin-bottom: 8px !important;
                display: inline-block !important;
                width: auto !important;
            }

            .${VITS_PDF_ROOT_CLASS} table th,
            .${VITS_PDF_ROOT_CLASS} table td {
                padding: 1px 4px !important;
                line-height: 1.1 !important;
                vertical-align: middle !important;
                font-size: 10pt !important;
                font-weight: 500 !important;
            }

            @media print {
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                }

                .${VITS_PDF_ROOT_CLASS} {
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    background: #ffffff !important;
                }

                .${VITS_PDF_PAGE_CLASS} {
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    page-break-after: always !important;
                    break-after: page !important;
                }

                .${VITS_PDF_PAGE_CLASS} + .${VITS_PDF_PAGE_CLASS} {
                    margin-top: 0 !important;
                    page-break-before: always !important;
                    break-before: page !important;
                }

                .${VITS_PDF_PAGE_CLASS}--last {
                    page-break-after: auto !important;
                    break-after: auto !important;
                }

                .${VITS_PDF_ROOT_CLASS} thead {
                    display: table-header-group;
                }

                .${VITS_PDF_ROOT_CLASS} .vits-avoid-break {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
            }
        `}</style>
    );
}

/** One official A4 sheet with its own VITS letterhead. */
export function VitsLetterheadPage({ children, isLast = false, pageFooter = null }) {
    const pageClass = [
        VITS_PDF_PAGE_CLASS,
        isLast ? `${VITS_PDF_PAGE_CLASS}--last` : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={pageClass}>
            <div className={VITS_PDF_LETTERHEAD_CLASS} aria-hidden data-pdf-letterhead="true">
                <img
                    src={VITS_LETTERHEAD_BG_URL}
                    alt=""
                    decoding="async"
                    loading="eager"
                />
            </div>
            <div className={VITS_PDF_CONTENT_CLASS}>{children}</div>
            {pageFooter}
        </div>
    );
}

/**
 * Document root wrapping one or more A4 letterhead pages.
 * Continuation content belongs on a second (or later) VitsLetterheadPage.
 */
export default function VitsLetterheadDocument({ children, className = '', id, rootRef }) {
    return (
        <div
            ref={rootRef}
            id={id}
            className={`${VITS_PDF_ROOT_CLASS} ${className}`.trim()}
        >
            <VitsLetterheadPageStyles />
            {children}
        </div>
    );
}
