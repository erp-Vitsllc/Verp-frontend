/** @typedef {{ button: HTMLButtonElement, pending: number, startedAt: number, releaseTimer?: ReturnType<typeof setTimeout> }} ActionGuardSession */

export const ACTION_GUARD_LOCKED_ATTR = 'data-action-guard-locked';
export const ACTION_GUARD_PROCESSING_ATTR = 'data-action-guard-processing';
export const NO_ACTION_GUARD_ATTR = 'data-no-action-guard';

/** Unlock UI-only clicks when no HTTP follows within this window. */
const UI_ONLY_RELEASE_MS = 600;
/** Grace after the last HTTP call — allows chained GET → PUT from one click. */
const CHAIN_GAP_RELEASE_MS = 400;
const MAX_GUARD_MS = 120000;

/** @type {ActionGuardSession | null} */
let activeSession = null;

const EXCLUDED_CLOSEST_SELECTORS = [
    '[data-no-action-guard]',
    '[data-filter-region]',
    '[role="tablist"]',
    '[role="combobox"]',
    '.react-datepicker',
    '[data-radix-popper-content-wrapper]',
    'nav',
    'aside[data-sidebar]',
].join(',');

function isFormControl(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'OPTION' || tag === 'LABEL';
}

/**
 * Resolve a transactional action button from an event target.
 * @param {EventTarget | null} target
 * @returns {HTMLButtonElement | null}
 */
export function resolveActionButtonFromTarget(target) {
    if (!target || !(target instanceof Element)) return null;
    if (isFormControl(target)) return null;

    const el = target.closest('button, [data-slot="button"]');
    if (!el || !(el instanceof HTMLButtonElement)) {
        if (el && el.getAttribute('role') === 'button' && el.hasAttribute('data-action-guard')) {
            return /** @type {HTMLButtonElement} */ (el);
        }
        return null;
    }

    if (el.getAttribute(NO_ACTION_GUARD_ATTR) === 'true') return null;
    if (el.closest(EXCLUDED_CLOSEST_SELECTORS)) return null;
    if (el.getAttribute('type') === 'reset') return null;

    return el;
}

export function isButtonActionGuardLocked(button) {
    return button?.getAttribute?.(ACTION_GUARD_LOCKED_ATTR) === 'true';
}

export function lockActionButton(button) {
    if (!button || isButtonActionGuardLocked(button)) return false;
    button.setAttribute(ACTION_GUARD_LOCKED_ATTR, 'true');
    button.setAttribute(ACTION_GUARD_PROCESSING_ATTR, 'true');
    button.setAttribute('aria-busy', 'true');
    return true;
}

export function unlockActionButton(button) {
    if (!button) return;
    button.removeAttribute(ACTION_GUARD_LOCKED_ATTR);
    button.removeAttribute(ACTION_GUARD_PROCESSING_ATTR);
    button.removeAttribute('aria-busy');
}

function clearReleaseTimer(session) {
    if (session?.releaseTimer) {
        clearTimeout(session.releaseTimer);
        session.releaseTimer = undefined;
    }
}

function scheduleRelease(session, delayMs) {
    clearReleaseTimer(session);
    session.releaseTimer = setTimeout(() => {
        if (session.pending > 0) return;
        unlockActionButton(session.button);
        if (activeSession === session) activeSession = null;
    }, delayMs);
}

function scheduleMaxRelease(session) {
    setTimeout(() => {
        if (activeSession !== session) return;
        session.pending = 0;
        unlockActionButton(session.button);
        activeSession = null;
    }, MAX_GUARD_MS);
}

/**
 * Lock immediately on click and track until API completes (or idle timeout for UI-only clicks).
 * @param {HTMLButtonElement} button
 * @returns {boolean}
 */
export function beginActionGuardSession(button) {
    if (isButtonActionGuardLocked(button)) return false;
    if (!lockActionButton(button)) return false;

    const session = {
        button,
        pending: 0,
        startedAt: Date.now(),
    };
    activeSession = session;
    scheduleMaxRelease(session);
    scheduleRelease(session, UI_ONLY_RELEASE_MS);
    return true;
}

export function getActiveActionGuardSession() {
    return activeSession;
}

/**
 * Attach any in-flight axios call triggered by the clicked button (including prefetch GETs).
 * @param {import('axios').InternalAxiosRequestConfig} config
 */
export function attachRequestToActionGuard(config) {
    const session = activeSession;
    if (!session) return;
    if (Date.now() - session.startedAt > MAX_GUARD_MS) return;

    session.pending += 1;
    config._actionGuardSession = session;
    clearReleaseTimer(session);
    lockActionButton(session.button);
}

/**
 * Release guard when the tracked request settles.
 * @param {import('axios').InternalAxiosRequestConfig | undefined} config
 */
export function completeActionGuardRequest(config) {
    const session = config?._actionGuardSession;
    if (!session) return;

    if (session.pending > 0) {
        session.pending -= 1;
    }

    if (session.pending <= 0) {
        scheduleRelease(session, CHAIN_GAP_RELEASE_MS);
    }
}

/**
 * Wrap any async handler with click / double-submit protection.
 * @template {(...args: any[]) => any} T
 * @param {T} handler
 * @returns {(...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>}
 */
export function guardAsyncHandler(handler) {
    let inFlight = false;
    return async (...args) => {
        if (inFlight) return undefined;
        inFlight = true;
        try {
            return await handler(...args);
        } finally {
            inFlight = false;
        }
    };
}
