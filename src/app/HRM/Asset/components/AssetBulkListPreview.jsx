'use client';

import { useState } from 'react';
import { Package, X } from 'lucide-react';

/** Show this many asset rows before collapsing to "+N more" when total >= MORE_THRESHOLD. */
export const ASSET_BULK_PREVIEW_VISIBLE = 4;
export const ASSET_BULK_MORE_THRESHOLD = 5;

/**
 * Compact bulk asset list. When count >= 5, shows the first few + clickable "+N more"
 * which opens a modal with the full list (same pattern for Leave / EOS / Return).
 */
export default function AssetBulkListPreview({
    assets = [],
    title = 'Selected assets',
    visibleCount = ASSET_BULK_PREVIEW_VISIBLE,
    moreThreshold = ASSET_BULK_MORE_THRESHOLD,
    emptyLabel = 'No assets selected',
    accent = 'indigo',
    /** Optional render for trailing content per row (e.g. checkbox). */
    renderTrailing = null,
    className = '',
}) {
    const [showFullList, setShowFullList] = useState(false);
    const list = Array.isArray(assets) ? assets.filter(Boolean) : [];
    const collapse = list.length >= moreThreshold;
    const visible = collapse ? list.slice(0, visibleCount) : list;
    const remaining = Math.max(0, list.length - visible.length);

    const accentBar =
        accent === 'amber'
            ? 'bg-amber-500'
            : accent === 'rose'
                ? 'bg-rose-500'
                : 'bg-indigo-500';
    const accentIcon =
        accent === 'amber'
            ? 'bg-amber-50 text-amber-600 border-amber-100'
            : accent === 'rose'
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : 'bg-indigo-50 text-indigo-600 border-indigo-100';
    const moreBtn =
        accent === 'amber'
            ? 'text-amber-700 hover:bg-amber-50'
            : accent === 'rose'
                ? 'text-rose-700 hover:bg-rose-50'
                : 'text-indigo-700 hover:bg-indigo-50';

    const renderRow = (item, idx, { isPrimary = false } = {}) => {
        const key = item._id || item.id || item.assetId || idx;
        return (
            <div
                key={String(key)}
                className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm relative overflow-hidden"
            >
                {isPrimary && <div className={`absolute top-0 left-0 w-1 h-full ${accentBar}`} />}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${accentIcon}`}>
                    <Package size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{item.name || 'Asset'}</p>
                    <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5 truncate">
                        {item.assetId || '—'}
                    </p>
                </div>
                {typeof renderTrailing === 'function' ? renderTrailing(item) : null}
            </div>
        );
    };

    return (
        <>
            <div className={`space-y-2 ${className}`}>
                <div className="flex items-center justify-between gap-2 pl-1">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        {title} ({list.length})
                    </p>
                </div>

                {list.length === 0 ? (
                    <p className="text-xs text-center text-slate-400 py-4 font-bold uppercase">{emptyLabel}</p>
                ) : (
                    <div className="space-y-2">
                        {visible.map((item, idx) => renderRow(item, idx, { isPrimary: idx === 0 }))}
                        {collapse && remaining > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowFullList(true)}
                                className={`w-full py-2.5 text-sm font-bold rounded-xl border border-dashed border-slate-200 transition-colors ${moreBtn}`}
                            >
                                +{remaining} more
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showFullList && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                    {list.length} asset{list.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFullList(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {list.map((item, idx) => renderRow(item, idx, { isPrimary: idx === 0 }))}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={() => setShowFullList(false)}
                                className="w-full py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
