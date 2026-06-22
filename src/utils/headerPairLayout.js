/** Shared layout for the top two header cards in a row (equal height via grid stretch, no scrollbars). */
export const HEADER_PAIR_GRID =
    'grid w-full max-w-full grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch';
/** Profile / action header cards — height follows content, clipped not scrolled. */
export const HEADER_PAIR_CARD =
    'flex flex-col min-w-0 w-full h-full overflow-hidden';
/** Fixed-height pair used on detail pages (fine, loan, reward). */
export const HEADER_PAIR_CARD_FIXED =
    'flex flex-col min-w-0 w-full h-[320px] min-h-[320px] max-h-[320px] overflow-hidden';
export const HEADER_PAIR_CARD_BODY =
    'w-full h-full overflow-hidden break-words';
/** Dashboard stat panels — modest min-height only (charts/grids inside, no card scroll). */
export const HEADER_PAIR_CARD_DASHBOARD =
    'flex flex-col min-w-0 w-full h-full overflow-hidden min-h-[220px]';

/** Two equal columns for detail panels below tabs (e.g. fine history). */
export const DETAIL_PAIR_GRID =
    'grid w-full max-w-full grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch';
export const DETAIL_PAIR_COLUMN = 'min-w-0 w-full flex flex-col';
