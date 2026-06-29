/** Static labels and copy from the official Asset Hand Over Form PDF. */

export const PDF_FONT_FAMILY = "Georgia, 'Times New Roman', Times, serif";
export const PDF_PAGE1_FONT_FAMILY = "Calibri, Arial, Helvetica, sans-serif";
export const PDF_INK = '#000000';
export const PDF_LINK = PDF_INK;
export const PDF_ROOT_CLASS = 'vehicle-handover-pdf';
export const PDF_PAGE1_CLASS = 'vehicle-handover-pdf-page1';
export const PDF_PAGE_SURFACE_CLASS = 'vehicle-handover-pdf-page';

/** ISO A4 — used for screen preview and print page shells */
export const PDF_A4_WIDTH = '210mm';
export const PDF_A4_HEIGHT = '297mm';
export const PDF_PAGE_PADDING_X = '18mm';
export const PDF_PAGE_PADDING_Y = '15mm';

/** Main document headings — consistent across PDF pages */
export const PDF_DOCUMENT_TITLE_SKIN = 'vehicle-handover-pdf-doc-title';
export const PDF_DOCUMENT_TITLE_CLASS = `${PDF_DOCUMENT_TITLE_SKIN} text-center font-bold leading-snug`;

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
