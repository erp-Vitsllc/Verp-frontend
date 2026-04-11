'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fades and slides content in when it enters the viewport (scroll-triggered).
 * prefers-reduced-motion is handled in globals.css (.scroll-reveal-track).
 */
export default function ScrollReveal({
    children,
    className,
    /** Extra delay after the element becomes visible (stagger siblings). */
    delayMs = 0,
    durationMs = 700,
    /** Intersection threshold (0–1). */
    threshold = 0.12,
    /** Trigger slightly before the element is fully on screen. */
    rootMargin = '0px 0px -5% 0px',
    once = true,
}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once) obs.disconnect();
                } else if (!once) {
                    setVisible(false);
                }
            },
            { root: null, rootMargin, threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [once, rootMargin, threshold]);

    return (
        <div
            ref={ref}
            className={cn(
                'scroll-reveal-track transition-[opacity,transform] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
                className
            )}
            style={{
                transitionDuration: `${durationMs}ms`,
                transitionDelay: visible ? `${delayMs}ms` : '0ms',
            }}
        >
            {children}
        </div>
    );
}
