'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import MarkAttendanceDetailsModal, {
    getMarkFormConfig,
} from '@/app/HRM/Attendance/mark/components/MarkAttendanceDetailsModal';

const MARK_OPTIONS = [
    { key: 'work_from_home', label: 'Work from home' },
    { key: 'on_office', label: 'On work' },
    {
        key: 'on_leave',
        label: 'On leave',
        children: [
            { key: 'sick_leave', label: 'Sick leave' },
            { key: 'authorized_leave', label: 'Authorized leave' },
            { key: 'unauthorized_leave', label: 'Unauthorized leave' },
        ],
    },
    { key: 'late_arrived', label: 'Late arrived' },
    { key: 'clear_attendance', label: 'Clear attendance' },
];

function displayName(person) {
    return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || 'Employee';
}

function collectTreeIds(nodes, out = []) {
    (Array.isArray(nodes) ? nodes : []).forEach((n) => {
        if (n?._id) out.push(String(n._id));
        if (n?.children?.length) collectTreeIds(n.children, out);
    });
    return out;
}

function TeamNode({ node, level = 0, selectedId, checkedIds, onToggle, onSelect }) {
    const children = Array.isArray(node?.children) ? node.children : [];
    const hasChildren = children.length > 0;
    const [open, setOpen] = useState(level < 2);
    const id = String(node?._id || '');
    const selected = selectedId && id === String(selectedId);
    const checked = checkedIds?.has(id);

    return (
        <div>
            <div
                className={`flex items-center gap-1 rounded-lg pr-2 ${
                    selected ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                }`}
                style={{ paddingLeft: `${Math.min(level, 8) * 14 + 4}px` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0"
                        aria-label={open ? 'Collapse' : 'Expand'}
                    >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="h-7 w-7 inline-flex items-center justify-center shrink-0">
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                    </span>
                )}

                <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={() => onToggle?.(id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#EA3D2F] focus:ring-[#EA3D2F]/30 cursor-pointer shrink-0"
                    aria-label={`Select ${displayName(node)}`}
                />

                <button
                    type="button"
                    onClick={() => onSelect?.(node)}
                    className="flex-1 min-w-0 py-2 text-left"
                >
                    <p
                        className={`text-sm truncate ${
                            selected ? 'font-semibold text-sky-800' : 'font-medium text-slate-800'
                        }`}
                    >
                        {displayName(node)}
                        {level === 0 ? (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                You
                            </span>
                        ) : null}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                        {[node.employeeId, node.designation].filter(Boolean).join(' · ') || '—'}
                    </p>
                </button>
            </div>

            {hasChildren && open
                ? children.map((child) => (
                      <TeamNode
                          key={String(child._id)}
                          node={child}
                          level={level + 1}
                          selectedId={selectedId}
                          checkedIds={checkedIds}
                          onToggle={onToggle}
                          onSelect={onSelect}
                      />
                  ))
                : null}
        </div>
    );
}

export default function AttendanceTeamTreeModal({
    open,
    selectedId,
    onClose,
    onSelect,
    onMarked,
}) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [tree, setTree] = useState([]);
    const [checkedIds, setCheckedIds] = useState(() => new Set());
    const [markMenuOpen, setMarkMenuOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [formState, setFormState] = useState(null);

    const allIds = useMemo(() => collectTreeIds(tree), [tree]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            setCheckedIds(new Set());
            setMarkMenuOpen(false);
            try {
                const res = await axiosInstance.get('/Attendance/team-tree', { skipToast: true });
                if (cancelled) return;
                setTree(Array.isArray(res.data?.tree) ? res.data.tree : []);
            } catch (err) {
                if (!cancelled) {
                    setTree([]);
                    setError(err?.response?.data?.message || 'Could not load team tree.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const toggleOne = (id) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === allIds.length) {
            setCheckedIds(new Set());
            return;
        }
        setCheckedIds(new Set(allIds));
    };

    const applyMark = async (payload, ids) => {
        if (!ids.length) return;
        setSaving(true);
        setError('');
        try {
            await axiosInstance.post('/Attendance/team/mark', {
                employeeMongoIds: ids,
                statusKey: payload.markKey || payload.statusKey,
                statusLabel: payload.markLabel || payload.statusLabel,
                timeIn: payload.timeIn ?? '',
                timeOut: payload.timeOut ?? '',
                reason: payload.reason || '',
                attachmentName: payload.attachmentName || '',
            });
            onMarked?.(ids);
            setMarkMenuOpen(false);
            setFormState(null);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not mark attendance.');
        } finally {
            setSaving(false);
        }
    };

    const requestMark = (key, label) => {
        const ids = Array.from(checkedIds);
        if (!ids.length) {
            setError('Select at least one team member.');
            return;
        }
        const config = getMarkFormConfig(key);
        if (!config) {
            applyMark({ markKey: key, markLabel: label, timeIn: null, timeOut: null }, ids);
            return;
        }
        setFormState({ markKey: key, markLabel: label, employeeIds: ids });
        setMarkMenuOpen(false);
    };

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-lg max-h-[85vh] rounded-2xl bg-white shadow-xl border border-slate-200 flex flex-col overflow-hidden"
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <h2 className="text-base font-semibold text-slate-900">See Teams</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Click a name to open their calendar. Select people and Mark All to set
                            attendance.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allIds.length > 0 && checkedIds.size === allIds.length}
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#EA3D2F]"
                        />
                        Select all ({checkedIds.size})
                    </label>

                    <div className="relative">
                        <button
                            type="button"
                            disabled={saving || checkedIds.size === 0}
                            onClick={() => setMarkMenuOpen((v) => !v)}
                            className="h-8 px-3 rounded-lg bg-[#EA3D2F] hover:bg-[#d43528] text-white text-xs font-semibold disabled:opacity-40"
                        >
                            {saving ? 'Saving…' : 'Mark All'}
                        </button>
                        {markMenuOpen ? (
                            <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                {MARK_OPTIONS.map((opt) => {
                                    if (opt.children?.length) {
                                        return (
                                            <div
                                                key={opt.key}
                                                className="relative"
                                                onMouseEnter={() => setLeaveOpen(true)}
                                                onMouseLeave={() => setLeaveOpen(false)}
                                            >
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                    onClick={() => setLeaveOpen((v) => !v)}
                                                >
                                                    <span>{opt.label}</span>
                                                    <ChevronRight size={14} className="text-slate-400" />
                                                </button>
                                                {leaveOpen ? (
                                                    <div className="absolute right-full top-0 mr-0.5 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                                        {opt.children.map((child) => (
                                                            <button
                                                                key={child.key}
                                                                type="button"
                                                                onClick={() =>
                                                                    requestMark(child.key, child.label)
                                                                }
                                                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                            >
                                                                {child.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => requestMark(opt.key, opt.label)}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                                opt.key === 'clear_attendance'
                                                    ? 'text-slate-500 border-t border-slate-100 mt-0.5'
                                                    : 'text-slate-700'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                    {loading ? (
                        <p className="text-sm text-slate-400 text-center py-10">Loading team…</p>
                    ) : error ? (
                        <p className="text-sm text-red-500 text-center py-10">{error}</p>
                    ) : tree.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10">No team members found.</p>
                    ) : (
                        tree.map((node) => (
                            <TeamNode
                                key={String(node._id)}
                                node={node}
                                selectedId={selectedId}
                                checkedIds={checkedIds}
                                onToggle={toggleOne}
                                onSelect={(person) => {
                                    onSelect?.(person);
                                    onClose?.();
                                }}
                            />
                        ))
                    )}
                </div>

                <MarkAttendanceDetailsModal
                    open={Boolean(formState)}
                    employee={null}
                    employeeIds={formState?.employeeIds}
                    markKey={formState?.markKey}
                    markLabel={formState?.markLabel}
                    onClose={() => setFormState(null)}
                    onSave={(payload) => {
                        const ids = formState?.employeeIds || [];
                        applyMark(payload, ids);
                    }}
                />
            </div>
        </div>,
        document.body,
    );
}
