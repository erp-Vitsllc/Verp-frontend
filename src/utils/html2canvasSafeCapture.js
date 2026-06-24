const UNSUPPORTED_COLOR_FN_RE = /\b(?:lab|oklch|lch|color-mix)\s*\(/i;

const COLOR_PROPS = [
    'color',
    'background-color',
    'background',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    'column-rule-color',
    'caret-color',
    'fill',
    'stroke',
    'box-shadow',
    'text-shadow',
];

function hasUnsupportedColorFn(value) {
    return typeof value === 'string' && UNSUPPORTED_COLOR_FN_RE.test(value);
}

function replaceUnsupportedColorFunctions(cssText) {
    if (!cssText) return '';
    return String(cssText)
        .replace(/lab\((?:[^()]*|\([^()]*\))*\)/gi, '#888888')
        .replace(/oklch\((?:[^()]*|\([^()]*\))*\)/gi, '#888888')
        .replace(/lch\((?:[^()]*|\([^()]*\))*\)/gi, '#888888')
        .replace(/color-mix\((?:[^()]*|\([^()]*\))*\)/gi, '#888888');
}

export function collectSanitizedStylesheets() {
    let safeCss = '';
    Array.from(document.styleSheets).forEach((sheet) => {
        try {
            const rules = sheet.cssRules || [];
            for (const rule of rules) {
                safeCss += `${replaceUnsupportedColorFunctions(rule.cssText)}\n`;
            }
        } catch {
            /* cross-origin stylesheet */
        }
    });
    return safeCss;
}

function fallbackForProp(prop) {
    if (prop === 'background' || prop === 'background-color') return '#ffffff';
    if (prop.includes('border') || prop === 'outline-color' || prop === 'column-rule-color') return '#e6e6e6';
    if (prop === 'box-shadow' || prop === 'text-shadow' || prop === 'background') return 'none';
    if (prop === 'fill') return '#252525';
    if (prop === 'stroke') return 'none';
    return '#252525';
}

/**
 * html2canvas cannot parse modern CSS color functions (lab, oklch, lch, color-mix).
 * Tailwind v4 emits these in compiled CSS — strip them on the cloned document before capture.
 */
export function sanitizeClonedDocumentForHtml2Canvas(clonedDoc, rootElementId = null) {
    clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());

    const styleTag = clonedDoc.createElement('style');
    styleTag.textContent = collectSanitizedStylesheets();
    clonedDoc.head.appendChild(styleTag);

    const view = clonedDoc.defaultView;
    if (!view) return;

    const root = rootElementId ? clonedDoc.getElementById(rootElementId) : clonedDoc.body;
    const nodes = root ? [root, ...root.querySelectorAll('*')] : [...clonedDoc.querySelectorAll('*')];

    nodes.forEach((el) => {
        if (!(el instanceof view.HTMLElement)) return;
        const computed = view.getComputedStyle(el);
        COLOR_PROPS.forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (!hasUnsupportedColorFn(val)) return;
            el.style.setProperty(prop, fallbackForProp(prop), 'important');
        });
    });
}

export function buildHtml2CanvasOptions(overrides = {}) {
    const { rootElementId, onclone: userOnClone, ...rest } = overrides;
    return {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        ...rest,
        onclone: (clonedDoc) => {
            sanitizeClonedDocumentForHtml2Canvas(clonedDoc, rootElementId);
            userOnClone?.(clonedDoc);
        },
    };
}
