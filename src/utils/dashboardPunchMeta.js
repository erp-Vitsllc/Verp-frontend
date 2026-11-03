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

const LAST_COORDS_KEY = 'verp_browser_location';

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

function isPermissionDenied(err) {
    const code = Number(err?.code);
    return code === 1 || /denied|permission/i.test(String(err?.message || ''));
}

function geoErrorResult(err) {
    return {
        coords: null,
        error: geoFailureMessage(err),
        denied: isPermissionDenied(err),
        timedOut: Number(err?.code) === 3 || /timeout/i.test(String(err?.message || '')),
    };
}

/** Desktop Macs locate from Wi-Fi. iPadOS reports a Mac platform but has GPS. */
function isMacDesktop() {
    if (typeof navigator === 'undefined') return false;
    const ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/i.test(ua)) return false;
    const platform = String(navigator.userAgentData?.platform || navigator.platform || '');
    if (Number(navigator.maxTouchPoints) > 1 && /Mac/i.test(platform)) return false;
    return /Mac OS X|Macintosh/i.test(ua) || /^mac/i.test(platform);
}

function rememberBrowserCoords(coords) {
    if (!coords || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(LAST_COORDS_KEY, JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            at: Date.now(),
        }));
    } catch {
        // Private mode can reject storage. The live fix is still usable.
    }
}

function cachedBrowserCoords(maxAgeMs) {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = JSON.parse(sessionStorage.getItem(LAST_COORDS_KEY) || 'null');
        const latitude = Number(raw?.latitude);
        const longitude = Number(raw?.longitude);
        const at = Number(raw?.at);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(at)) return null;
        if (Date.now() - at > maxAgeMs) return null;
        const accuracy = Number(raw?.accuracy);
        return {
            latitude,
            longitude,
            ...(Number.isFinite(accuracy) ? { accuracy } : {}),
        };
    } catch {
        return null;
    }
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
        return geoErrorResult(err);
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
                finish(geoErrorResult(err));
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
        denied: Boolean(fromNative.denied || fromBrowser.denied),
    };
}

function isHttpPage() {
    if (typeof window === 'undefined') return false;
    return window.location.protocol === 'http:';
}

async function fetchJson(url, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Chrome/Safari block GPS on http:// hosts (except localhost). Test servers still need a point. */
async function readHttpFallbackLocation() {
    const sources = [
        {
            url: 'http://ip-api.com/json/?fields=status,lat,lon',
            pick: (d) => (d?.status === 'success' ? [d.lat, d.lon] : null),
        },
        {
            url: 'https://ipwho.is/',
            pick: (d) => (d?.success === false ? null : [d?.latitude, d?.longitude]),
        },
        {
            url: 'https://ipapi.co/json/',
            pick: (d) => [d?.latitude, d?.longitude],
        },
    ];
    for (const source of sources) {
        const data = await fetchJson(source.url);
        if (!data) continue;
        const pair = source.pick(data);
        const latitude = Number(pair?.[0]);
        const longitude = Number(pair?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
        return { latitude, longitude, accuracy: 5000 };
    }
    return null;
}

function hasCapacitorGeo() {
    return Boolean(typeof window !== 'undefined' && window.Capacitor?.Plugins?.Geolocation?.getCurrentPosition);
}

/**
 * Macs have no GPS chip. High-accuracy getCurrentPosition waits out the timeout,
 * then Core Location returns "unavailable" — login sits there, then errors.
 * watchPosition can ignore that transient error and take the Wi-Fi fix.
 * Must be started inside the click. Safari drops the prompt after an await.
 */
function readMacLocation(timeoutMs, options = {}) {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({
                coords: null,
                error: 'Location is not available on this device. Turn on location, then try again.',
            });
            return;
        }
        const geo = navigator.geolocation;
        if (!geo.watchPosition) {
            resolve(readNavigatorLocation(timeoutMs, {
                enableHighAccuracy: false,
                maximumAge: options.maximumAge,
            }));
            return;
        }
        let settled = false;
        let watchId = null;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            if (watchId != null) {
                try { geo.clearWatch(watchId); } catch { /* already cleared */ }
            }
            resolve(value);
        };
        const timer = setTimeout(
            () => finish(geoErrorResult({ code: 3 })),
            timeoutMs + 400,
        );
        watchId = geo.watchPosition(
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
                // Code 2/3 are often a first blip before the Wi-Fi fix. Keep watching.
                if (!isPermissionDenied(err)) return;
                clearTimeout(timer);
                finish(geoErrorResult(err));
            },
            {
                enableHighAccuracy: false,
                maximumAge: Number.isFinite(options.maximumAge) ? options.maximumAge : 0,
            },
        );
    });
}

export async function requireBrowserLocation(timeoutMs = 20000, options = {}) {
    const preferCached = options?.preferCached === true;
    const insecureHttp =
        isHttpPage() && typeof window !== 'undefined' && window.isSecureContext === false;

    if (preferCached) {
        const recent = cachedBrowserCoords(2 * 60 * 1000);
        if (recent) return recent;
    }

    if (isMacDesktop()) {
        const budget = insecureHttp
            ? 3000
            : Math.min(Math.max(Number(timeoutMs) || 12000, 8000), 15000);
        const macAge = preferCached ? 5 * 60 * 1000 : 60 * 1000;
        // Start the browser watch before any await so Safari still shows the prompt.
        const macFixPromise = readMacLocation(budget, { maximumAge: macAge });
        if (hasCapacitorGeo()) {
            await requestNativeLocationAccess();
            const native = await readCapacitorLocation(budget, {
                enableHighAccuracy: false,
                maximumAge: macAge,
            });
            if (native.coords) {
                rememberBrowserCoords(native.coords);
                return native.coords;
            }
            if (native.denied) {
                throw locationRequiredError(native.error || LOCATION_REQUIRED_MESSAGE);
            }
        }
        const macFix = await macFixPromise;
        if (macFix.coords) {
            rememberBrowserCoords(macFix.coords);
            return macFix.coords;
        }
        if (macFix.denied) {
            throw locationRequiredError(macFix.error || LOCATION_REQUIRED_MESSAGE);
        }
        if (isHttpPage()) {
            const fallback = await readHttpFallbackLocation();
            if (fallback) return fallback;
        }
        if (preferCached) {
            const stale = cachedBrowserCoords(30 * 60 * 1000);
            if (stale) return stale;
        }
        throw locationRequiredError(macFix.error || LOCATION_REQUIRED_MESSAGE);
    }

    const networkTimeout = insecureHttp ? 3000 : Math.min(Math.max(timeoutMs, 8000), 12000);
    const gpsTimeout = insecureHttp ? 3000 : Math.min(timeoutMs, preferCached ? 8000 : 15000);

    // Start GPS in this click. Safari/Mac drops the prompt if we await anything first.
    const firstTry = readNavigatorLocation(networkTimeout, {
        enableHighAccuracy: false,
        maximumAge: preferCached ? 5 * 60 * 1000 : 60 * 1000,
    });

    if (hasCapacitorGeo()) {
        await requestNativeLocationAccess();
        const native = await readCapacitorLocation(networkTimeout, {
            enableHighAccuracy: false,
            maximumAge: preferCached ? 5 * 60 * 1000 : 60 * 1000,
        });
        if (native.coords) {
            rememberBrowserCoords(native.coords);
            return native.coords;
        }
    }

    const network = await firstTry;
    if (network.coords) {
        rememberBrowserCoords(network.coords);
        return network.coords;
    }
    if (network.denied) {
        throw locationRequiredError(network.error || LOCATION_REQUIRED_MESSAGE);
    }

    const gps = await readBestPosition(gpsTimeout, {
        enableHighAccuracy: true,
        maximumAge: 15000,
    });
    if (gps.coords) {
        rememberBrowserCoords(gps.coords);
        return gps.coords;
    }

    if (isHttpPage()) {
        const fallback = await readHttpFallbackLocation();
        if (fallback) return fallback;
    }

    if (!gps.denied && preferCached) {
        const stale = cachedBrowserCoords(30 * 60 * 1000);
        if (stale) return stale;
    }

    throw locationRequiredError(network.error || gps.error || LOCATION_REQUIRED_MESSAGE);
}

/** Call from a Turn On click so the browser/OS can show its system location prompt. */
export async function promptSystemLocation(options) {
    const preferCached = options?.preferCached === true;
    return requireBrowserLocation(preferCached ? 12000 : 20000, { preferCached });
}

export async function readBrowserLocation(timeoutMs = 10000) {
    try {
        return await requireBrowserLocation(timeoutMs);
    } catch {
        return null;
    }
}
