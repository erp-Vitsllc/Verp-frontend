'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DASH_CARD =
    'bg-white border border-[#E7EBF1] rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition-[box-shadow,border-color] duration-200 ease-out';

export const DASH_CARD_INTERACTIVE = cn(
    DASH_CARD,
    'group/card cursor-pointer hover:shadow-[0_4px_12px_rgba(16,24,40,0.07)] hover:border-[#D8DEE8]',
);

const HOVER_LIFT = { y: -1, transition: { duration: 0.18, ease: 'easeOut' } };

export function DashboardCard({
    className,
    interactive = false,
    children,
    whileHover,
    ...props
}) {
    return (
        <motion.article
            {...props}
            whileHover={interactive ? HOVER_LIFT : whileHover}
            className={cn(interactive ? DASH_CARD_INTERACTIVE : DASH_CARD, className)}
        >
            {children}
        </motion.article>
    );
}

export function SectionHeader({ icon: Icon, iconWrap, title, subtitle, action }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                {Icon ? (
                    <div
                        className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                            iconWrap,
                        )}
                    >
                        <Icon size={16} />
                    </div>
                ) : null}
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#111827] leading-tight">{title}</h3>
                    {subtitle ? (
                        <p className="text-[11px] text-[#8792A6] mt-0.5 truncate">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

export function EmptyState({ icon: Icon, title, description, className }) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-1 px-3 py-3 text-center', className)}>
            {Icon ? <Icon size={18} strokeWidth={1.75} className="text-[#8792A6]" /> : null}
            {title ? <p className="text-[13px] font-semibold text-[#111827] leading-tight">{title}</p> : null}
            {description ? <p className="text-[11px] text-[#8792A6] leading-tight">{description}</p> : null}
        </div>
    );
}

export function StatusBadge({ children, className }) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none',
                className,
            )}
        >
            {children}
        </span>
    );
}

export function MetricCardBody({
    icon: Icon,
    iconWrap,
    title,
    count,
    label,
    hint,
    arrowHover = 'group-hover/card:text-slate-700',
    compact = false,
}) {
    return (
        <div className={cn('flex h-full min-h-0 flex-col', compact ? 'px-2 py-1.5' : '')}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200',
                            iconWrap,
                        )}
                    >
                        <Icon size={16} />
                    </div>
                    <h3 className="text-[13px] sm:text-sm font-semibold text-[#111827] truncate leading-tight">
                        {title}
                    </h3>
                </div>
                <ArrowUpRight
                    size={16}
                    className={cn(
                        'text-[#8792A6] shrink-0 mt-0.5 transition-all duration-200 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5',
                        arrowHover,
                    )}
                />
            </div>
            <div className="mt-auto pt-3">
                <p className="text-[26px] sm:text-[28px] font-bold text-[#111827] tabular-nums leading-none">
                    {count}
                </p>
                {label ? (
                    <p className="text-[11px] font-medium text-[#8792A6] mt-1.5 leading-tight">{label}</p>
                ) : null}
                {hint ? (
                    <p className="text-[11px] text-[#8792A6] mt-0.5 leading-tight">{hint}</p>
                ) : null}
            </div>
        </div>
    );
}

export function MetricCard({
    icon,
    iconWrap,
    title,
    count,
    label,
    hint,
    arrowHover,
    className,
    ...props
}) {
    return (
        <DashboardCard interactive className={cn('p-4 h-[138px]', className)} {...props}>
            <MetricCardBody
                icon={icon}
                iconWrap={iconWrap}
                title={title}
                count={count}
                label={label}
                hint={hint}
                arrowHover={arrowHover}
            />
        </DashboardCard>
    );
}

export function metricHint(count, emptyText) {
    return count > 0 ? 'View details' : emptyText;
}
