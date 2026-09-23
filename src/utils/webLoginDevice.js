const DEVICE_KEY = 'verp_web_device_id';

export function getWebDeviceId() {
    if (typeof window === 'undefined') return '';
    try {
        let id = String(window.localStorage.getItem(DEVICE_KEY) || '').trim();
        if (!id) {
            id = window.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            window.localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return '';
    }
}

export function detectWebOs() {
    if (typeof navigator === 'undefined') return '';
    const ua = String(navigator.userAgent || '');
    const platform = String(navigator.userAgentData?.platform || navigator.platform || '');
    if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'Windows';
    if (/Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform)) return 'macOS';
    if (/CrOS/i.test(ua) || /Chrome OS/i.test(platform)) return 'ChromeOS';
    if (/Android/i.test(ua) || /Android/i.test(platform)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua) || /iOS|iPhone/i.test(platform)) return 'iOS';
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';
    return platform || '';
}

export function detectWebDeviceName() {
    const os = detectWebOs();
    if (os === 'Windows') return 'Windows PC';
    if (os === 'macOS') return 'Mac';
    if (os === 'ChromeOS') return 'Chromebook';
    if (os === 'Android') return 'Android browser';
    if (os === 'iOS') return 'iOS browser';
    if (os === 'Linux') return 'Linux PC';
    return 'Web browser';
}

let publicIpCache = { at: 0, ip: '', pending: null };

function rememberPublicIp(value) {
    const ip = String(value || '').trim();
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !ip.includes(':')) return publicIpCache.ip || '';
    publicIpCache = { at: Date.now(), ip, pending: null };
    return ip;
}

/** Public IP of this browser's network. Cached for one minute. */
export function refreshWebPublicIp() {
    if (typeof window === 'undefined') return Promise.resolve('');
    if (publicIpCache.ip && Date.now() - publicIpCache.at < 60 * 1000) {
        return Promise.resolve(publicIpCache.ip);
    }
    if (publicIpCache.pending) return publicIpCache.pending;
    const lookup = fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) })
        .then((response) => response.json())
        .then((payload) => rememberPublicIp(payload?.ip))
        .catch(() => publicIpCache.ip || '');
    publicIpCache.pending = lookup.finally(() => {
        publicIpCache.pending = null;
    });
    return publicIpCache.pending;
}

export function webDevicePayload() {
    return {
        deviceId: getWebDeviceId(),
        os: detectWebOs(),
        deviceName: detectWebDeviceName(),
        publicIp: publicIpCache.ip || '',
    };
}
