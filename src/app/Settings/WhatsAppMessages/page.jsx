'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    Check,
    CheckCheck,
    Loader2,
    MessageCircle,
    Search,
    Send,
} from 'lucide-react';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'received', label: 'Received' },
    { id: 'sent', label: 'Sent' },
    { id: 'auto', label: 'Auto send' },
];

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = new Date().toDateString() === date.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initials(name, phone) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return String(phone || '?').slice(-2);
}

function sourceLabel(message) {
    if (!message) return '';
    if (message.autoSend || message.source === 'auto') return 'Auto send';
    if (message.source === 'broadcast') return 'Broadcast';
    if (message.source === 'template') return 'Template';
    if (message.direction === 'in') return 'Received';
    return 'Manual';
}

function StatusTicks({ status }) {
    const value = String(status || '').toLowerCase();
    if (value === 'failed') {
        return <span className="text-[10px] font-semibold text-red-200">Failed</span>;
    }
    if (value === 'read') {
        return <CheckCheck size={14} className="text-sky-200" />;
    }
    if (value === 'delivered') {
        return <CheckCheck size={14} className="text-emerald-100/90" />;
    }
    if (value === 'sent' || value === 'queued') {
        return <Check size={14} className="text-emerald-100/80" />;
    }
    return null;
}

export default function WhatsAppMessagesPage() {
    const { toast } = useToast();
    const threadEndRef = useRef(null);

    const [accessChecked, setAccessChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [loadingList, setLoadingList] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [activePhone, setActivePhone] = useState('');
    const [thread, setThread] = useState(null);
    const [loadingThread, setLoadingThread] = useState(false);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/whatsapp/access', { skipToast: true });
                if (!cancelled) {
                    setAllowed(!!res.data?.allowed);
                    setAccessChecked(true);
                }
            } catch {
                if (!cancelled) {
                    setAllowed(false);
                    setAccessChecked(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const loadConversations = useCallback(async () => {
        setLoadingList(true);
        try {
            const params = {};
            if (search) params.search = search;
            if (filter !== 'all') params.filter = filter;
            const res = await axiosInstance.get('/whatsapp/conversations', { params, skipToast: true });
            setConversations(Array.isArray(res.data?.conversations) ? res.data.conversations : []);
        } catch (error) {
            toast({
                title: 'Could not load WhatsApp messages',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setLoadingList(false);
        }
    }, [filter, search, toast]);

    const loadThread = useCallback(
        async (phone, { quiet = false } = {}) => {
            if (!phone) return;
            if (!quiet) setLoadingThread(true);
            try {
                const res = await axiosInstance.get('/whatsapp/thread', {
                    params: { phone },
                    skipToast: true,
                });
                setThread(res.data || null);
            } catch (error) {
                if (!quiet) {
                    toast({
                        title: 'Could not load chat',
                        description: error.response?.data?.message || error.message,
                        variant: 'destructive',
                    });
                }
            } finally {
                if (!quiet) setLoadingThread(false);
            }
        },
        [toast],
    );

    useEffect(() => {
        if (!allowed) return;
        loadConversations();
    }, [allowed, loadConversations]);

    useEffect(() => {
        if (!allowed) return undefined;
        let cancelled = false;
        const loadStatus = async () => {
            try {
                const res = await axiosInstance.get('/whatsapp/status', { skipToast: true });
                if (!cancelled) setWebhookStatus(res.data || null);
            } catch {
                if (!cancelled) setWebhookStatus(null);
            }
        };
        loadStatus();
        const timer = setInterval(loadStatus, 20000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [allowed]);

    useEffect(() => {
        if (!allowed || !activePhone) return;
        loadThread(activePhone);
    }, [allowed, activePhone, loadThread]);

    useEffect(() => {
        if (!allowed) return undefined;
        const timer = setInterval(() => {
            loadConversations();
            if (activePhone) loadThread(activePhone, { quiet: true });
        }, 8000);
        return () => clearInterval(timer);
    }, [allowed, activePhone, loadConversations, loadThread]);

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread?.messages?.length, activePhone]);

    const activeConversation = useMemo(
        () => conversations.find((row) => row.phone === activePhone) || null,
        [conversations, activePhone],
    );

    const headerName =
        thread?.contactName || activeConversation?.contactName || activePhone || 'Select a chat';
    const headerMeta = [
        activePhone ? `+${activePhone}` : '',
        thread?.employeeId || activeConversation?.employeeId || '',
    ]
        .filter(Boolean)
        .join(' · ');

    const inboundMissing =
        Boolean(activePhone) &&
        Array.isArray(thread?.messages) &&
        thread.messages.length > 0 &&
        thread.messages.every((row) => row.direction !== 'in');
    const webhookNeverSeen = !webhookStatus?.lastWebhookAt && !(webhookStatus?.inboundStored > 0);

    const sendReply = async (event) => {
        event?.preventDefault?.();
        const text = draft.trim();
        if (!activePhone || !text || sending) return;
        setSending(true);
        try {
            await axiosInstance.post(
                '/whatsapp/thread',
                { phone: activePhone, message: text },
                { skipToast: true },
            );
            setDraft('');
            await Promise.all([loadThread(activePhone, { quiet: true }), loadConversations()]);
        } catch (error) {
            toast({
                title: 'Message not sent',
                description: error.response?.data?.error || error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setSending(false);
        }
    };

    if (!accessChecked) {
        return (
            <div className="flex min-h-screen bg-slate-50">
                <Sidebar />
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex min-h-screen bg-slate-50">
                <Sidebar />
                <div className="flex flex-1 flex-col">
                    <Navbar />
                    <main className="flex flex-1 items-center justify-center p-8">
                        <p className="text-slate-600">
                            You do not have access to WhatsApp Messages.
                        </p>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#f4f6f8]">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0">
                <Navbar />
                <main className="flex-1 min-h-0 p-3 sm:p-4 lg:p-5">
                    <div className="h-[calc(100vh-5.75rem)] min-h-[32rem] flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <aside className="w-full max-w-[22rem] shrink-0 flex flex-col border-r border-slate-200 bg-[#f0f2f5]">
                            <div className="px-4 py-3 bg-[#008069] text-white">
                                <div className="flex items-center gap-2">
                                    <MessageCircle size={18} />
                                    <h1 className="text-base font-semibold">WhatsApp Messages</h1>
                                </div>
                                <p className="mt-1 text-[11px] text-white/80">
                                    Who sent, who received, history, and auto send
                                </p>
                            </div>
                            <form
                                className="px-3 py-2 bg-[#f0f2f5]"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    setSearch(searchInput.trim());
                                }}
                            >
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        placeholder="Search name, number, or message"
                                        className="w-full rounded-lg border-0 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                            </form>
                            <div className="flex gap-1 px-3 pb-2">
                                {FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setFilter(item.id)}
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                            filter === item.id
                                                ? 'bg-[#008069] text-white'
                                                : 'bg-white text-slate-600 border border-slate-200'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {loadingList && conversations.length === 0 ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-sm text-slate-500">
                                        No WhatsApp history yet. Sent, received, and auto messages will appear here.
                                    </p>
                                ) : (
                                    conversations.map((row) => {
                                        const active = row.phone === activePhone;
                                        const last = row.lastMessage || {};
                                        return (
                                            <button
                                                key={row.phone}
                                                type="button"
                                                onClick={() => setActivePhone(row.phone)}
                                                className={`flex w-full items-start gap-3 border-b border-slate-200 px-4 py-3 text-left ${
                                                    active ? 'bg-[#e7f8f2]' : 'bg-white hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-xs font-bold text-slate-600">
                                                    {initials(row.contactName, row.phone)}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-semibold text-slate-800">
                                                            {row.contactName || `+${row.phone}`}
                                                        </span>
                                                        <span className="shrink-0 text-[10px] text-slate-400">
                                                            {formatTime(last.occurredAt)}
                                                        </span>
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                        {last.direction === 'out' ? 'You: ' : 'Received: '}
                                                        {last.body || last.templateName || '—'}
                                                    </span>
                                                    <span className="mt-1 flex flex-wrap gap-1">
                                                        {row.inboundCount > 0 ? (
                                                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                                                {row.inboundCount} received
                                                            </span>
                                                        ) : null}
                                                        {row.outboundCount > 0 ? (
                                                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                                {row.outboundCount} sent
                                                            </span>
                                                        ) : null}
                                                        {row.autoCount > 0 ? (
                                                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                                                {row.autoCount} auto
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </aside>

                        <section className="min-w-0 flex-1 flex flex-col bg-[#efeae2]">
                            {activePhone ? (
                                <>
                                    <header className="flex items-center gap-3 border-b border-black/5 bg-[#008069] px-4 py-3 text-white">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                                            {initials(headerName, activePhone)}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">{headerName}</p>
                                            <p className="truncate text-[11px] text-white/80">{headerMeta}</p>
                                        </div>
                                    </header>
                                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                        {loadingThread && !thread?.messages?.length ? (
                                            <div className="flex justify-center py-16">
                                                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                                            </div>
                                        ) : (
                                            (thread?.messages || []).map((message) => {
                                                const outgoing = message.direction === 'out';
                                                return (
                                                    <div
                                                        key={message.id}
                                                        className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${
                                                                outgoing
                                                                    ? 'bg-[#d9fdd3] text-slate-800'
                                                                    : 'bg-white text-slate-800'
                                                            }`}
                                                        >
                                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                {outgoing
                                                                    ? [
                                                                          `Sent by ${message.sentByName || 'ERP'}`,
                                                                          message.accountPhone || message.fromPhone
                                                                              ? `Account +${message.accountPhone || message.fromPhone}`
                                                                              : '',
                                                                          sourceLabel(message),
                                                                      ]
                                                                          .filter(Boolean)
                                                                          .join(' · ')
                                                                    : [
                                                                          'Received',
                                                                          message.contactName ||
                                                                              (message.conversationPhone
                                                                                  ? `+${message.conversationPhone}`
                                                                                  : ''),
                                                                          message.accountPhone || message.toPhone
                                                                              ? `to +${message.accountPhone || message.toPhone}`
                                                                              : '',
                                                                      ]
                                                                          .filter(Boolean)
                                                                          .join(' · ')}
                                                            </p>
                                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                                                {message.body || message.templateName || '—'}
                                                            </p>
                                                            {message.error ? (
                                                                <p className="mt-1 text-[11px] text-red-600">{message.error}</p>
                                                            ) : null}
                                                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                                                                <span>{formatTime(message.occurredAt)}</span>
                                                                {outgoing ? <StatusTicks status={message.status} /> : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {inboundMissing ? (
                                            <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                                                <p className="font-semibold">Received replies are not in ERP yet</p>
                                                <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
                                                    Phone messages such as “hi” and “hy” stay on WhatsApp until Meta POSTs
                                                    them to{' '}
                                                    <span className="font-mono text-[12px]">
                                                        {webhookStatus?.webhookPath || '/api/whatsapp/webhook'}
                                                    </span>
                                                    . Sent bubbles appear because ERP saves them when it sends.
                                                    {webhookNeverSeen
                                                        ? ' Meta has not delivered an inbound webhook to this backend.'
                                                        : ''}
                                                </p>
                                            </div>
                                        ) : null}
                                        <div ref={threadEndRef} />
                                    </div>
                                    <form
                                        onSubmit={sendReply}
                                        className="flex items-end gap-2 border-t border-black/5 bg-[#f0f2f5] px-3 py-3"
                                    >
                                        <textarea
                                            value={draft}
                                            onChange={(event) => setDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' && !event.shiftKey) {
                                                    event.preventDefault();
                                                    void sendReply(event);
                                                }
                                            }}
                                            rows={1}
                                            placeholder="Type a message"
                                            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border-0 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        />
                                        <button
                                            type="submit"
                                            disabled={sending || !draft.trim()}
                                            className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#008069] text-white disabled:opacity-50"
                                            title="Send"
                                        >
                                            {sending ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Send size={16} />
                                            )}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="flex flex-1 flex-col items-center justify-center text-center px-8">
                                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#008069]/10 text-[#008069]">
                                        <MessageCircle size={28} />
                                    </div>
                                    <h2 className="text-lg font-semibold text-slate-800">WhatsApp Messages</h2>
                                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                                        Open a chat to see who sent it, who received it, return messages, and auto-send history.
                                    </p>
                                </div>
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
