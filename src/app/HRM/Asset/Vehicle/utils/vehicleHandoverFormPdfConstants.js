/** Static labels and copy from the official Asset Hand Over Form PDF. */

export const PDF_FONT_FAMILY = "Georgia, 'Times New Roman', Times, serif";
export const PDF_PAGE1_FONT_FAMILY = "Calibri, Arial, Helvetica, sans-serif";
export const PDF_INK = '#000000';
export const PDF_LINK = PDF_INK;
export const PDF_ROOT_CLASS = 'vehicle-handover-pdf';
export const PDF_PAGE1_CLASS = 'vehicle-handover-pdf-page1';
export const PDF_PAGE_SURFACE_CLASS = 'vehicle-handover-pdf-page';
export const PDF_PAGE_SURFACE_COMPACT_CLASS = 'vehicle-handover-pdf-page--compact';

/** ISO A4 — used for screen preview and print page shells */
export const PDF_A4_WIDTH = '210mm';
export const PDF_A4_HEIGHT = '297mm';
/** Pixel size at 96dpi — matches browser mm→px for html2canvas capture */
export const PDF_A4_WIDTH_PX = 794;
export const PDF_A4_HEIGHT_PX = 1123;

/** Client PDF download budget (user-facing attachment download). */
export const PDF_DOWNLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const PDF_CAPTURE_SCALE = 2;
export const PDF_JPEG_QUALITY = 0.88;
export const PDF_IMAGE_MAX_EDGE = 1280;
export const PDF_CANVAS_MAX_WIDTH = PDF_A4_WIDTH_PX * PDF_CAPTURE_SCALE;
export const PDF_LETTERHEAD_BG_URL = '/assets/handover_form_bg.png';
/** Content inset so body text clears the letterhead header and footer artwork */
export const PDF_PAGE_PADDING_TOP = '28mm';
export const PDF_PAGE_PADDING_BOTTOM = '32mm';
export const PDF_PAGE_PADDING_X = '18mm';
/** @deprecated use PDF_PAGE_PADDING_TOP / PDF_PAGE_PADDING_BOTTOM */
export const PDF_PAGE_PADDING_Y = '15mm';

/** Main document headings — consistent across PDF pages */
export const PDF_DOCUMENT_TITLE_SKIN = 'vehicle-handover-pdf-doc-title';
export const PDF_DOCUMENT_TITLE_CLASS = `${PDF_DOCUMENT_TITLE_SKIN} text-center font-semibold leading-snug`;

/** Shared table / emphasis — lighter lines, less bold */
export const PDF_TABLE_CLASS = 'w-full border-collapse border border-gray-400';
export const PDF_CELL_CLASS = 'w-1/2 border border-gray-300 p-1 align-top';
export const PDF_TABLE_STYLE = { borderCollapse: 'collapse', width: '100%', border: '1px solid #9ca3af' };
export const PDF_CELL_STYLE = { border: '1px solid #d1d5db', verticalAlign: 'top' };
export const PDF_PAGE1_CELL_CLASS =
    'border border-gray-300 px-1.5 py-1 text-center align-middle text-[10.5pt] font-normal';
export const PDF_TABLE_HEADER_CLASS = 'text-center text-[11pt] font-semibold';
export const PDF_CELL_LABEL_CLASS = 'text-[11pt] font-semibold leading-tight';
export const PDF_SECTION_EMPHASIS_CLASS = 'text-[11pt] font-semibold';

export const PDF_ACCESSORY_LABELS = {
    spareTyre: 'Spare type.',
    toolsKit: 'Tools Kit',
    scissorJack: 'Scissor Jacky',
    firstAidKit: 'Fist Aid Kit',
    fireExtinguisher: 'Fire extinguisher',
};

export const PDF_BODY_CONDITION_LABELS = {
    frontView: 'Front View',
    backView: 'Back View',
    frontRightCorner: 'Front Right Corner',
    backRightCorner: 'Back Right Corner',
    frontLeftCorner: 'Front left Corner',
    backLeftCorner: 'Back Left Corner',
    frontRightDoor: 'Front Right Door',
    backRightDoor: 'Back Right Door',
    frontLeftDoor: 'Front Let Door',
    backLeftDoor: 'Back Left Door',
    frontInsideView: 'Front Inside View',
    backInsideView: 'Back Inside View',
    frontDashBoard: 'Front Dash Board',
    carTopView: 'CAR Top View',
};
