'use client';

import { PDF_BODY_CONDITION_LABELS, PDF_CELL_CLASS, PDF_CELL_LABEL_CLASS, PDF_LINK, PDF_PAGE1_CLASS, PDF_TABLE_CLASS, PDF_TABLE_HEADER_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';
import VehicleHandoverPdfClosingSection from './VehicleHandoverPdfClosingSection';

export const PDF_TABLE = PDF_TABLE_CLASS;
export const PDF_CELL = PDF_CELL_CLASS;

export const PDF_BODY_PHOTO_HEIGHT = 'h-[38mm]';
export const PDF_ACCESSORY_PHOTO_HEIGHT = 'h-[30mm]';
/** Body-condition lead row on page 2 (below accessories). */
export const PDF_BODY_LEAD_PHOTO_HEIGHT = 'h-[30mm]';
/** First body-condition row pair shown below accessories on page 2. */
export const PDF_BODY_ROWS_ON_ACCESSORIES_PAGE = 1;
/** Body-condition row pairs on page 3 (after the lead pair on page 2). */
export const PDF_BODY_ROWS_FIRST_PAGE = 5;
/** Row pairs per continuation body-condition page. */
export const PDF_BODY_ROWS_PER_PAGE = 4;

/** Scale photo box height so N rows (+ optional closing block) fit one A4 sheet. */
export function resolveBodyPhotoHeight(pairCount, includesClosing = false) {
    if (includesClosing) {
        if (pairCount >= 5) return 'h-[28mm]';
        if (pairCount >= 4) return 'h-[30mm]';
        return 'h-[32mm]';
    }
    if (pairCount >= 5) return 'h-[32mm]';
    if (pairCount >= 4) return 'h-[34mm]';
    return PDF_BODY_PHOTO_HEIGHT;
}

function PdfLink({ children }) {
    return (
        <span style={{ color: PDF_LINK }}>
            {children}
        </span>
    );
}

function resolveRightLinkLabel(key) {
    if (key === 'backView') return 'Back View';
    if (key === 'backRightCorner') return 'Corner';
    return null;
}

export function PdfBodyConditionViewCell({ view, linkLabel, photoHeight = PDF_BODY_PHOTO_HEIGHT }) {
    const photoUrl = resolveAssessmentMediaUrl(view.photo);
    const label = PDF_BODY_CONDITION_LABELS[view.key] || view.label;

    const headerContent = (() => {
        if (linkLabel === 'Back View') {
            return <PdfLink>Back View</PdfLink>;
        }
        if (linkLabel === 'Corner') {
            return (
                <>
                    Back Right <PdfLink>Corner</PdfLink>
                </>
            );
        }
        return label;
    })();

    return (
        <td className={`${PDF_CELL} p-1.5`}>
            <p className={`mb-1 text-center ${PDF_CELL_LABEL_CLASS}`}>{headerContent}</p>
            <div className="mt-1 leading-none">
                {photoUrl ? (
                    <VehicleHandoverAssessmentPhotoPanel
                        url={photoUrl}
                        label={label}
                        sizeClass="w-full max-w-full"
                        borderClass="border-0"
                        roundedClass="rounded-none"
                        heightClass={photoHeight}
                    />
                ) : (
                    <div className={`w-full ${photoHeight} bg-white`} aria-hidden="true" />
                )}
            </div>
        </td>
    );
}

function PdfBodyConditionPairRow({ pair, photoHeight }) {
    return (
        <tr>
            <PdfBodyConditionViewCell view={pair.left} photoHeight={photoHeight} />
            <PdfBodyConditionViewCell
                view={pair.right}
                linkLabel={resolveRightLinkLabel(pair.right.key)}
                photoHeight={photoHeight}
            />
        </tr>
    );
}

export function PdfBodyConditionTable({
    pairs,
    className = '',
    showTitleRow = false,
    photoHeight = PDF_BODY_PHOTO_HEIGHT,
}) {
    if (!pairs.length && !showTitleRow) return null;

    return (
        <table className={`${PDF_TABLE} ${className}`}>
            <tbody>
                {showTitleRow ? (
                    <tr>
                        <td
                            colSpan={2}
                            className={`${PDF_CELL} ${PDF_TABLE_HEADER_CLASS}`}
                        >
                            Boady Condition Report
                        </td>
                    </tr>
                ) : null}
                {pairs.map((pair) => (
                    <PdfBodyConditionPairRow
                        key={`${pair.left.key}-${pair.right.key}`}
                        pair={pair}
                        photoHeight={photoHeight}
                    />
                ))}
            </tbody>
        </table>
    );
}

export function splitBodyConditionLayout(pairs) {
    if (!pairs?.length) {
        return { leadPair: null, pages: [] };
    }

    const leadPair = pairs[0];
    const rest = pairs.slice(PDF_BODY_ROWS_ON_ACCESSORIES_PAGE);
    return {
        leadPair,
        pages: rest.length ? chunkBodyConditionPages(rest) : [],
    };
}

export function chunkBodyConditionPages(pairs) {
    if (!pairs.length) return [];

    const firstPageSize = PDF_BODY_ROWS_FIRST_PAGE;
    if (pairs.length <= firstPageSize) return [pairs];

    const pages = [pairs.slice(0, firstPageSize)];
    for (let i = firstPageSize; i < pairs.length; i += PDF_BODY_ROWS_PER_PAGE) {
        pages.push(pairs.slice(i, i + PDF_BODY_ROWS_PER_PAGE));
    }
    return pages;
}

export default function VehicleHandoverPdfBodyConditionPage({
    pairs,
    showSectionTitle = false,
    showClosingSection = false,
    additionalInfo = '',
    receiver,
    officeUse,
    className = '',
}) {
    return (
        <div className={`${PDF_PAGE1_CLASS} ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            {showSectionTitle ? (
                <h2 className={`mb-1 ${PDF_TABLE_HEADER_CLASS}`}>Boady Condition Report</h2>
            ) : null}

            <PdfBodyConditionTable
                pairs={pairs}
                photoHeight={resolveBodyPhotoHeight(pairs.length, showClosingSection)}
            />

            {showClosingSection ? (
                <VehicleHandoverPdfClosingSection
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                    dense
                />
            ) : null}
        </div>
    );
}
