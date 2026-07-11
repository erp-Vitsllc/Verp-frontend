import {
    PDF_A4_HEIGHT_PX,
    PDF_A4_WIDTH_PX,
    PDF_PAGE_PADDING_BOTTOM,
    PDF_PAGE_PADDING_TOP,
    PDF_PAGE_PADDING_X,
} from './vehicleHandoverFormPdfConstants';

function parseMm(value) {
    const match = String(value || '').match(/^([\d.]+)mm$/i);
    return match ? Number(match[1]) : 0;
}

/** Convert CSS mm (used by the A4 page shell) to px at 96dpi. */
export function pdfMmToPx(mm) {
    return (Number(mm) * 96) / 25.4;
}

export const PDF_CONTENT_WIDTH_PX = Math.round(
    PDF_A4_WIDTH_PX - pdfMmToPx(parseMm(PDF_PAGE_PADDING_X)) * 2,
);

/** Usable body height between letterhead header and footer artwork. */
export const PDF_CONTENT_HEIGHT_PX = Math.floor(
    PDF_A4_HEIGHT_PX -
        pdfMmToPx(parseMm(PDF_PAGE_PADDING_TOP)) -
        pdfMmToPx(parseMm(PDF_PAGE_PADDING_BOTTOM)) -
        6,
);

/**
 * Pack measured row heights into pages that never split a row.
 * `trailingHeight` is reserved on the last page for the closing block when it fits.
 */
export function packMeasuredHeightsIntoPages(itemHeights, availableHeight, options = {}) {
    const trailingHeight = Math.max(0, Number(options.trailingHeight) || 0);
    const heights = Array.isArray(itemHeights) ? itemHeights.map((h) => Math.max(0, Number(h) || 0)) : [];
    const pages = [];
    let current = [];
    let used = 0;

    const flush = () => {
        if (!current.length) return;
        pages.push(current);
        current = [];
        used = 0;
    };

    heights.forEach((height, index) => {
        if (current.length > 0 && used + height > availableHeight) {
            flush();
        }

        current.push(index);
        used += height;
    });

    flush();

    let closingAlone = false;
    if (trailingHeight > 0) {
        if (!pages.length) {
            closingAlone = true;
        } else {
            const lastPage = pages[pages.length - 1];
            const lastUsed = lastPage.reduce((sum, idx) => sum + heights[idx], 0);
            if (lastUsed + trailingHeight > availableHeight) {
                closingAlone = true;
            }
        }
    }

    return { pages, closingAlone };
}

export function mapIndexPagesToPairs(pairs, indexPages) {
    return (indexPages || [])
        .map((indexes) => indexes.map((index) => pairs[index]).filter(Boolean))
        .filter((page) => page.length > 0);
}

export async function waitForPdfMeasureImages(root) {
    if (!root) return;
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(
            (img) =>
                new Promise((resolve) => {
                    if (img.complete) {
                        resolve();
                        return;
                    }
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                }),
        ),
    );
}
