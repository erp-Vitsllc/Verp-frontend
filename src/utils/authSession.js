import { toast } from '@/hooks/use-toast';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const IDLE_LAST_ACTIVITY_KEY = 'idleSessionLastActivity';

export function isAuthenticated() {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem('token'));
}

export function touchActivity(timestamp = Date.now()) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(IDLE_LAST_ACTIVITY_KEY, String(timestamp));
}

export function getLastActivityTime() {
    if (typeof window === 'undefined') return Date.now();
    const raw = sessionStorage.getItem(IDLE_LAST_ACTIVITY_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

export function getRemainingIdleMs(now = Date.now()) {
    const elapsed = now - getLastActivityTime();
    return Math.max(0, IDLE_TIMEOUT_MS - elapsed);
}

export function formatIdleCountdown(remainingMs) {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function clearAuthSession() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('employeeUser');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('tokenExpiresIn');
    localStorage.removeItem('isAdmin');
    sessionStorage.removeItem(IDLE_LAST_ACTIVITY_KEY);
}

export function performLogout({ reason = 'manual', redirectTo = '/login' } = {}) {
    clearAuthSession();

    if (typeof window === 'undefined') return;

    if (reason === 'idle') {
        toast({
            title: 'Session Ended',
            description: 'You were logged out after 1 hour of inactivity.',
            variant: 'destructive',
        });
        window.setTimeout(() => {
            window.location.href = redirectTo;
        }, 1500);
        return;
    }

    window.location.href = redirectTo;
}
