/** Stop mouse-wheel from changing focused number inputs while scrolling the page. */
export function preventNumberInputScroll(event) {
    if (!event) return;
    event.preventDefault();
    if (typeof event.currentTarget?.blur === 'function') {
        event.currentTarget.blur();
    }
}

/** Spread onto payment / money `type="number"` inputs. */
export const numberInputNoScrollProps = {
    onWheel: preventNumberInputScroll,
};
