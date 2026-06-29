'use client';

import { PDF_BODY_CONDITION_LABELS, PDF_LINK, PDF_PAGE1_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';
import VehicleHandoverPdfClosingSection from './VehicleHandoverPdfClosingSection';

export const PDF_TABLE = 'w-full border-collapse border border-black';
export const PDF_CELL = 'w-1/2 border border-black p-2 align-top';

export const PDF_BODY_PHOTO_HEIGHT = 'h-[45mm]';
export const PDF_ACCESSORY_PHOTO_HEIGHT = 'h-[40mm]';
/** Rows on the accessories page (same A4 sheet, small gap before body table) */
export const PDF_BODY_ROWS_ON_ACCESSORIES_PAGE = 2;
/** Rows per continuation body-condition page */
export const PDF_BODY_ROWS_PER_PAGE = 4;

function PdfLink({ children }) {
    return (
        <span className="underline" style={{ color: PDF_LINK }}>
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
        <td className={PDF_CELL}>
            <p className="mb-1 text-center text-[11pt] font-bold">{headerContent}</p>
            {photoUrl ? (
                <VehicleHandoverAssessmentPhotoPanel
                    url={photoUrl}
                    label={label}
                    sizeClass="w-full max-w-full"
                    borderClass="border-0"
                    roundedClass="rounded-none"
                    heightClass={photoHeight}
                />
            ) : null}
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
                            className={`${PDF_CELL} text-center text-[11pt] font-bold`}
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

export function chunkBodyConditionPages(
    pairs,
    rowsPerPage = PDF_BODY_ROWS_PER_PAGE,
    skipFirst = 0,
) {
    const remaining = skipFirst > 0 ? pairs.slice(skipFirst) : pairs;
    const pages = [];
    for (let i = 0; i < remaining.length; i += rowsPerPage) {
        pages.push(remaining.slice(i, i + rowsPerPage));
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
        <div className={`${PDF_PAGE1_CLASS} flex h-full flex-col ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            {showSectionTitle ? (
                <h2 className="mb-2 text-center text-[11pt] font-bold">Boady Condition Report</h2>
            ) : null}

            <PdfBodyConditionTable
                pairs={pairs}
                photoHeight={showClosingSection ? 'h-[32mm]' : PDF_BODY_PHOTO_HEIGHT}
            />

            {showClosingSection && receiver && officeUse ? (
                <VehicleHandoverPdfClosingSection
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                />
            ) : null}
        </div>
    );
}
