export const LOCATION_REQUIRED_MESSAGE =
    'Location is off. Turn on location, allow access, then try again.';

export function detectDashboardPunchSource() {
    if (typeof window === 'undefined') return 'web';
    if (window.Capacitor || window.cordova || window.ReactNativeWebView) return 'app';
    const ua = String(navigator.userAgent || '');
    if (/VeRPApp|VerpApp|okhttp|Capacitor|Cordova|CFNetwork/i.test(ua)) return 'app';
    return 'web';
}

export function punchLocationPayload(coords) {
    if (!coords) return {};
    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
    const accuracy = Number(coords.accuracy);
    return {
        latitude,
        longitude,
        location: { latitude, longitude },
        ...(Number.isFinite(accuracy) ? { accuracy } : {}),
    };
}

export function hasValidCoords(coords) {
    if (!coords) return false;
    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

export async function buildDashboardPunchBody({ requireLocation = false } = {}) {
    const source = detectDashboardPunchSource();
    const coords = requireLocation
        ? await requireBrowserLocation()
        : await readBrowserLocation();
    return {
        source,
        ...punchLocationPayload(coords),
    };
}

function locationRequiredError(message) {
    const err = new Error(message || LOCATION_REQUIRED_MESSAGE);
    err.code = 'LOCATION_REQUIRED';
    return err;
}

function geoFailureMessage(err) {
    const code = Number(err?.code);
    if (code === 1 || /denied|permission/i.test(String(err?.message || ''))) {
        return LOCATION_REQUIRED_MESSAGE;
    }
    if (code === 2) {
        return 'Could not read your location. Turn on location services, then try again.';
    }
    if (code === 3 || /timeout/i.test(String(err?.message || ''))) {
        return 'Location timed out. Turn on location and try again.';
    }
    return LOCATION_REQUIRED_MESSAGE;
}

function coordsFromPosition(pos) {
    const c = pos?.coords;
    if (!c) return null;
    const latitude = Number(c.latitude);
    const longitude = Number(c.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const accuracy = Number(c.accuracy);
    return {
        latitude,
        longitude,
        ...(Number.isFinite(accuracy) ? { accuracy } : {}),
    };
}

async function readCapacitorLocation(timeoutMs) {
    if (typeof window === 'undefined') {
        return { coords: null, error: LOCATION_REQUIRED_MESSAGE };
    }
    const geo = window.Capacitor?.Plugins?.Geolocation;
    if (!geo?.getCurrentPosition) return { coords: null, error: '' };
    try {
        const pos = await Promise.race([
            geo.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeoutMs + 250);
            }),
        ]);
        const coords = coordsFromPosition(pos);
        if (coords) return { coords, error: '' };
        return { coords: null, error: LOCATION_REQUIRED_MESSAGE };
    } catch (err) {
        return { coords: null, error: geoFailureMessage(err) };
    }
}

function readNavigatorLocation(timeoutMs) {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({
                coords: null,
                error: 'Location is not available on this device. Turn on location, then try again.',
            });
            return;
        }
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timer = setTimeout(
            () => finish({ coords: null, error: geoFailureMessage({ code: 3 }) }),
            timeoutMs,
        );
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                const coords = coordsFromPosition(pos);
                finish(
                    coords
                        ? { coords, error: '' }
                        : { coords: null, error: LOCATION_REQUIRED_MESSAGE },
                );
            },
            (err) => {
                clearTimeout(timer);
                finish({ coords: null, error: geoFailureMessage(err) });
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
        );
    });
}

export async function requireBrowserLocation(timeoutMs = 12000) {
    const fromNative = await readCapacitorLocation(timeoutMs);
    if (fromNative.coords) return fromNative.coords;
    const fromBrowser = await readNavigatorLocation(timeoutMs);
    if (fromBrowser.coords) return fromBrowser.coords;
    throw locationRequiredError(fromNative.error || fromBrowser.error || LOCATION_REQUIRED_MESSAGE);
}

export async function readBrowserLocation(timeoutMs = 10000) {
    try {
        return await requireBrowserLocation(timeoutMs);
    } catch {
        return null;
    }
}
