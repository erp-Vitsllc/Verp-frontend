/** Shared layout for the top two header cards in a row (equal height via grid stretch, no scrollbars). */
export const HEADER_PAIR_GRID =
    'grid w-full max-w-full grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8 items-stretch';

/**
 * Standard top header-card size used across modules (Companies / Fine / Reward / etc).
 * Desktop: fixed 320px tall — matches inspected Companies card (~760×320).
 */
export const HEADER_PAIR_CARD_HEIGHT =
    'h-auto min-h-[220px] sm:min-h-[280px] lg:h-[320px]';

/** Matches Companies header card padding (lg = 24px). */
export const HEADER_PAIR_CARD_PADDING = 'p-3 sm:p-4 lg:p-6';

/** Profile / action header cards — same fixed panel size as dashboard pair. */
export const HEADER_PAIR_CARD =
    `flex flex-col min-w-0 w-full overflow-hidden ${HEADER_PAIR_CARD_HEIGHT}`;

/** Fixed-height pair used on detail pages (fine, loan, reward, vehicle). */
export const HEADER_PAIR_CARD_FIXED =
    `flex flex-col min-w-0 w-full overflow-hidden ${HEADER_PAIR_CARD_HEIGHT}`;

export const HEADER_PAIR_CARD_BODY =
    'w-full h-full overflow-hidden break-words';

/** Dashboard / list page top cards — same 320px desktop height everywhere. */
export const HEADER_PAIR_CARD_DASHBOARD =
    `flex flex-col min-w-0 w-full overflow-hidden ${HEADER_PAIR_CARD_HEIGHT}`;

/**
 * Same fixed height as dashboard pair, but allows native select dropdowns
 * (month / year filters) to open outside the card without being clipped.
 */
export const HEADER_PAIR_CARD_DASHBOARD_FILTER =
    `relative z-10 flex flex-col min-w-0 w-full overflow-visible ${HEADER_PAIR_CARD_HEIGHT}`;

/**
 * Utility Bills list + details — same fixed panel size as other header pairs.
 */
export const HEADER_PAIR_CARD_UTILITY =
    `lg:col-span-1 relative flex flex-col min-w-0 w-full overflow-hidden ${HEADER_PAIR_CARD_HEIGHT}`;

/** Two equal columns for detail panels below tabs (e.g. fine history). */
export const DETAIL_PAIR_GRID =
    'grid w-full max-w-full grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8 items-stretch';
export const DETAIL_PAIR_COLUMN = 'min-w-0 w-full flex flex-col';
