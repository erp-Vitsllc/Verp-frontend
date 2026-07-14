'use client';

import {
    VITS_PDF_FONT_FAMILY,
    VITS_PDF_INK,
} from './constants';

/**
 * Estimate signature underline width from the longest label under it.
 * Expands for long names; never shrinks content fonts.
 */
export function signatureLineWidthCh(name, minCh = 18, maxCh = 52) {
    const len = String(name || '').trim().length;
    return Math.min(maxCh, Math.max(minCh, len + 2));
}

/** Same size as other body labels (compact). */
const textStyle = {
    fontFamily: VITS_PDF_FONT_FAMILY,
    fontSize: '10pt',
    fontWeight: 500,
    fontStyle: 'normal',
    color: VITS_PDF_INK,
    lineHeight: 1.15,
};

/**
 * Professional signature column:
 * Title → Signature → Full Name → Date: DD/MM/YYYY
 */
export default function VitsSignatureBlock({
    title,
    name,
    dateLabel,
    signatureUrl = null,
    note = null,
}) {
    const lineCh = signatureLineWidthCh(name);
    const lineStyle = {
        width: `${lineCh}ch`,
        maxWidth: '100%',
        borderBottom: `1px solid ${VITS_PDF_INK}`,
        minHeight: signatureUrl ? '2px' : '36px',
        marginBottom: '2px',
    };

    return (
        <section className="vits-avoid-break vits-signature-block" style={{ marginBottom: '8px' }}>
            <h2
                className="vits-sig-label"
                style={{
                    ...textStyle,
                    margin: '0 0 4px 0',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                }}
            >
                {title}
            </h2>

            <div style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'top' }}>
                {signatureUrl ? (
                    <div style={{ marginBottom: '2px' }}>
                        <img
                            src={signatureUrl}
                            alt=""
                            loading="eager"
                            decoding="async"
                            style={{
                                height: '64px',
                                maxWidth: `${Math.max(lineCh, 28)}ch`,
                                width: 'auto',
                                objectFit: 'contain',
                                objectPosition: 'left bottom',
                                display: 'block',
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                ) : null}

                <div style={lineStyle} />

                <div
                    className="vits-sig-label"
                    style={{
                        ...textStyle,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'visible',
                        maxWidth: '100%',
                    }}
                >
                    {name || '—'}
                </div>

                <div
                    className="vits-sig-label"
                    style={{
                        ...textStyle,
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {dateLabel ? `Date: ${dateLabel}` : 'Date:'}
                </div>

                {note ? (
                    <p
                        className="vits-sig-label"
                        style={{
                            ...textStyle,
                            marginTop: '4px',
                            marginBottom: 0,
                            maxWidth: `${Math.max(lineCh, 36)}ch`,
                        }}
                    >
                        {note}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
