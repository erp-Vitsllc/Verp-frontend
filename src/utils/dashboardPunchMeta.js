export const LOCATION_REQUIRED_MESSAGE =
    'Location is off. Turn on location, allow access, then try again.';

const LOCATION_ERROR_RE =
    /location is off|turn on location|could not read your location|location timed out|location is not available|location is blocked|location needs a secure/i;

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
        lat: latitude,
        lng: longitude,
        location: `${latitude}, ${longitude}`,
        ...(Number.isFinite(accuracy) ? { accuracy } : {}),
    };
}

export function hasValidCoords(coords) {
    if (!coords) return false;
    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

export function isLocationRequiredError(err) {
    if (!err) return false;
    if (err.code === 'LOCATION_REQUIRED') return true;
    const msg = String(err.response?.data?.message || err.message || '');
    return LOCATION_ERROR_RE.test(msg);
}

export async function buildDashboardPunchBody({ requireLocation = false, coords = null } = {}) {
    const source = detectDashboardPunchSource();
    const resolved = hasValidCoords(coords)
        ? coords
        : requireLocation
          ? await requireBrowserLocation()
          : await readBrowserLocation();
    return {
        source,
        ...punchLocationPayload(resolved),
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
        return 'Location is blocked for this site. Tap Turn On and allow location on the system prompt.';
    }
    if (code === 2) {
        return 'Could not read your location. Turn on location services, then tap Turn On.';
    }
    if (code === 3 || /timeout/i.test(String(err?.message || ''))) {
        return 'Location timed out. Turn on location, then tap Turn On and wait for the system prompt.';
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

async function requestNativeLocationAccess() {
    if (typeof window === 'undefined') return;
    const geo = window.Capacitor?.Plugins?.Geolocation;
    if (!geo?.requestPermissions) return;
    try {
        await geo.requestPermissions({ permissions: ['location'] });
    } catch {
        // User dismissed the system permission sheet; still try to read GPS.
    }
}

async function readCapacitorLocation(timeoutMs, options = {}) {
    if (typeof window === 'undefined') {
        return { coords: null, error: LOCATION_REQUIRED_MESSAGE };
    }
    const geo = window.Capacitor?.Plugins?.Geolocation;
    if (!geo?.getCurrentPosition) return { coords: null, error: '' };
    try {
        const pos = await Promise.race([
            geo.getCurrentPosition({
                enableHighAccuracy: Boolean(options.enableHighAccuracy),
                timeout: timeoutMs,
                maximumAge: Number.isFinite(options.maximumAge) ? options.maximumAge : 0,
            }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeoutMs + 400);
            }),
        ]);
        const coords = coordsFromPosition(pos);
        if (coords) return { coords, error: '' };
        return { coords: null, error: LOCATION_REQUIRED_MESSAGE };
    } catch (err) {
        return { coords: null, error: geoFailureMessage(err) };
    }
}

function readNavigatorLocation(timeoutMs, options = {}) {
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
            timeoutMs + 500,
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
            {
                enableHighAccuracy: Boolean(options.enableHighAccuracy),
                timeout: timeoutMs,
                maximumAge: Number.isFinite(options.maximumAge) ? options.maximumAge : 0,
            },
        );
    });
}

async function readBestPosition(timeoutMs, options) {
    const fromNative = await readCapacitorLocation(timeoutMs, options);
    if (fromNative.coords) return fromNative;
    const fromBrowser = await readNavigatorLocation(timeoutMs, options);
    if (fromBrowser.coords) return fromBrowser;
    return {
        coords: null,
        error: fromNative.error || fromBrowser.error || LOCATION_REQUIRED_MESSAGE,
    };
}

export async function requireBrowserLocation(timeoutMs = 20000) {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
        throw locationRequiredError(
            'Location needs a secure connection (HTTPS). Open the ERP with https, then try again.',
        );
    }

    await requestNativeLocationAccess();

    // Wi-Fi / cell / cached position first. High-accuracy GPS often times out
    // indoors even when the device Location toggle is already on.
    const network = await readBestPosition(Math.min(Math.max(timeoutMs, 8000), 15000), {
        enableHighAccuracy: false,
        maximumAge: 180000,
    });
    if (network.coords) return network.coords;

    const gps = await readBestPosition(timeoutMs, {
        enableHighAccuracy: true,
        maximumAge: 15000,
    });
    if (gps.coords) return gps.coords;

    throw locationRequiredError(network.error || gps.error || LOCATION_REQUIRED_MESSAGE);
}

/** Call from a Turn On click so the browser/OS can show its system location prompt. */
export async function promptSystemLocation() {
    return requireBrowserLocation(45000);
}

export async function readBrowserLocation(timeoutMs = 10000) {
    try {
        return await requireBrowserLocation(timeoutMs);
    } catch {
        return null;
    }
}
