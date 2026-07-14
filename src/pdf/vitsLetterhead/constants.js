/**
 * Reusable VITS official letterhead — A4 portrait ERP PDF template.
 * Use for Asset Handover and future documents (Transfer, Loan, Vehicle, etc.).
 */

/** Official letterhead rasterized from VITS-Letter-Head-Abudhabi.pdf (A4). */
export const VITS_LETTERHEAD_BG_URL = '/assets/vits_letterhead_abudhabi.png';

/** Embedded Times New Roman (public/fonts) — required for all ERP PDF text. */
export const VITS_PDF_FONT_FAMILY = "'Times New Roman', Times, serif";
export const VITS_PDF_FONT_REGULAR_URL = '/fonts/TimesNewRoman.ttf';
export const VITS_PDF_FONT_BOLD_URL = '/fonts/TimesNewRoman-Bold.ttf';
export const VITS_PDF_FONT_ITALIC_URL = '/fonts/TimesNewRoman-Italic.ttf';

/** ISO A4 portrait — download / print / scan must match exactly. */
export const VITS_PDF_A4_WIDTH = '210mm';
export const VITS_PDF_A4_HEIGHT = '297mm';

/**
 * Protected content insets inside each A4 page frame.
 * Content never enters letterhead header/footer artwork.
 */
export const VITS_PDF_SAFE_TOP = '36mm';
export const VITS_PDF_SAFE_BOTTOM = '52mm';
export const VITS_PDF_SAFE_X = '18mm';

export const VITS_PDF_ROOT_CLASS = 'vits-letterhead-pdf-root';
export const VITS_PDF_PAGE_CLASS = 'vits-letterhead-pdf-page';
export const VITS_PDF_LETTERHEAD_CLASS = 'vits-letterhead-pdf-letterhead';
export const VITS_PDF_CONTENT_CLASS = 'vits-letterhead-pdf-content';

export const VITS_PDF_INK = '#000000';
export const VITS_PDF_MUTED = '#000000';
export const VITS_PDF_BORDER = '#000000';
/** Tables: border only — no fill */
export const VITS_PDF_HEADER_BG = 'transparent';
export const VITS_PDF_ALT_ROW = 'transparent';
