import axios from 'axios';
import { toast } from '@/hooks/use-toast';
import {
    redirectToNotFound,
    shouldApiErrorRedirectToNotFound,
} from '@/utils/notFoundRedirect';

const DEFAULT_API_URL = 'http://localhost:5000/api';
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

/** When the UI is opened via LAN IP, `localhost` in the API URL points at the wrong machine. */
export function resolveClientApiBaseUrl() {
    if (typeof window === 'undefined') return CONFIGURED_API_URL;
    try {
        const configured = new URL(CONFIGURED_API_URL);
        const pageHost = window.location.hostname;
        const isLocalPage = pageHost === 'localhost' || pageHost === '127.0.0.1';
        const configuredIsLocalhost =
            configured.hostname === 'localhost' || configured.hostname === '127.0.0.1';
        if (!isLocalPage && configuredIsLocalhost) {
            return `${window.location.protocol}//${pageHost}:${configured.port || '5000'}/api`;
        }
    } catch {
        /* use configured */
    }
    return CONFIGURED_API_URL;
}

let apiOriginForErrors = 'http://localhost:5000';
try {
    apiOriginForErrors = new URL(CONFIGURED_API_URL).origin;
} catch {
    /* keep default */
}

const axiosInstance = axios.create({
    baseURL: CONFIGURED_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 90000, // 90 seconds timeout (increased for large file uploads)
});

/** Prevent duplicate session-expired toasts/redirects when many requests fail at once. */
let sessionExpiryHandled = false;

export function resetSessionExpiryHandled() {
    sessionExpiryHandled = false;
}

export function isSessionAuthError(error) {
    const status = error?.response?.status ?? error?.originalError?.response?.status;
    if (status === 401) return true;
    if (error?.silent && error?.isAuthError) return true;
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('token expired') || msg.includes('not authorized');
}

// Request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            config.baseURL = resolveClientApiBaseUrl();
            try {
                apiOriginForErrors = new URL(config.baseURL).origin;
            } catch {
                /* keep previous */
            }
        }

        const requestUrl = (config?.url || '').toString().toLowerCase();
        const isAuthEndpoint =
            requestUrl.endsWith('/login') ||
            requestUrl.includes('/login?') ||
            requestUrl.includes('/api/login');

        // For file uploads (FormData), don't set Content-Type header
        // Let the browser set it automatically with the correct boundary
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        // Add authorization token from localStorage if available
        if (typeof window !== 'undefined' && !isAuthEndpoint) {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }

        // Preserve custom config flags (like skipToast) for response interceptor
        // These will be available in error.config in the response interceptor
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Check if this is a silent error (permission check)
        const requestUrl = error.config?.url || '';
        const isUnassignedAssetsCheck = requestUrl.includes('/AssetItem/unassigned/controller/') ||
            requestUrl.includes('unassigned/controller');
        const isSilentError = error.config?.skipToast || isUnassignedAssetsCheck;

        const status = error.response?.status;
        const isNetworkError = !error.response && Boolean(error.request);
        if (error.response && status === 404) {
            // It's just a 404, valid case for checks. Use warn to reduce noise.
            console.warn('Axios 404 (Not Found):', requestUrl);
        } else if (!isSilentError && !isNetworkError && status !== 401 && !(status >= 400 && status < 500)) {
            console.error('Axios Error:', error);
        } else if (!isSilentError && !isNetworkError && status >= 400 && status < 500) {
            console.warn('Axios client error:', requestUrl, error.response?.data?.message || status);
        }
        if (error.response) {
            // Server responded with error status
            const errorData = error.response.data || {};

            // Handle 401 Unauthorized - token expired or invalid
            if (error.response.status === 401) {
                const errorMessage = errorData.message || 'Session expired';
                const isTokenExpired =
                    errorMessage.toLowerCase().includes('token expired') ||
                    errorMessage.toLowerCase().includes('expired');

                if (typeof window !== 'undefined' && !sessionExpiryHandled) {
                    sessionExpiryHandled = true;

                    if (isTokenExpired) {
                        toast({
                            title: 'Session Expired',
                            description: 'Your session has expired. Please sign in again.',
                            variant: 'destructive',
                        });
                    }

                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('employeeUser');
                    localStorage.removeItem('userPermissions');
                    localStorage.removeItem('tokenExpiresIn');

                    if (window.location.pathname !== '/login') {
                        setTimeout(() => {
                            const currentPath = window.location.pathname;
                            window.location.href = `/login?redirectTo=${encodeURIComponent(currentPath)}`;
                        }, isTokenExpired ? 1500 : 0);
                    }
                }

                return Promise.reject({
                    message: errorMessage,
                    ...errorData,
                    response: error.response,
                    originalError: error,
                    silent: true,
                    isAuthError: true,
                });
            }

            const willRedirectToNotFound = shouldApiErrorRedirectToNotFound(error);

            // Handle 403 Forbidden - permission denied
            if (error.response.status === 403) {
                const errorMessage = errorData.message || 'Access denied. You don\'t have permission to perform this action.';

                // Skip toast if skipToast flag is set in request config (for permission checks)
                const skipToast = error.config?.skipToast || false;

                // Also skip toast for unassigned assets check (it's just a permission check)
                const requestUrl = error.config?.url || '';
                const isUnassignedAssetsCheck = requestUrl.includes('/AssetItem/unassigned/controller/') ||
                    requestUrl.includes('unassigned/controller');

                // Show toast only when staying on the page (not redirecting to 404)
                if (
                    !skipToast &&
                    !isUnassignedAssetsCheck &&
                    !willRedirectToNotFound &&
                    typeof window !== 'undefined'
                ) {
                    toast({
                        title: "Access Denied",
                        description: errorMessage,
                        variant: "destructive",
                    });
                }

                // Skip console logging for unassigned assets check (it's expected for non-controllers)
                if (isUnassignedAssetsCheck || skipToast) {
                    // Silently handle - don't log to console, don't show toast
                    return Promise.reject({
                        message: errorMessage,
                        ...errorData,
                        response: error.response,
                        originalError: error,
                        silent: true // Flag to indicate this is a silent error
                    });
                }
            }

            // Preserve the original error message from backend
            const errorMessage = errorData.message || `Server error: ${error.response.status}`;
            // Perform logging based on status
            if (error.response.status === 404) {
                // For 404, we already warned above. No need for detailed noise.
            } else if (error.response.status === 403) {
                // Check if this is a silent permission check
                const requestUrl = error.config?.url || '';
                const isSilent403 = error.config?.skipToast ||
                    requestUrl.includes('/AssetItem/unassigned/controller/') ||
                    requestUrl.includes('unassigned/controller');
                if (!isSilent403) {
                    // Only log non-silent 403 errors
                    console.error('Backend error response:', errorData);
                    console.error('Backend error message:', errorMessage);
                }
            } else if (error.response.status === 401) {
                // Session missing or invalid; storage clear + redirect already applied above.
            } else if (error.response.status === 429 && error.config?.skipToast) {
                // Background polls (sidebar, etc.) — avoid console spam when rate-limited.
            } else {
                console.error('Backend error response:', errorData);
                console.error('Backend error message:', errorMessage);
            }

            const rejection = {
                message: errorMessage,
                ...errorData,
                response: error.response,
                originalError: error,
            };
            if (willRedirectToNotFound) {
                redirectToNotFound();
                return Promise.reject({
                    ...rejection,
                    silent: true,
                    redirectedToNotFound: true,
                });
            }
            const method = String(error.config?.method || 'get').toLowerCase();
            if (
                !isSilentError &&
                typeof window !== 'undefined' &&
                method !== 'get' &&
                method !== 'head' &&
                error.response.status >= 500
            ) {
                toast({
                    title: 'Request failed',
                    description: errorMessage,
                    variant: 'destructive',
                });
            }
            return Promise.reject(rejection);
        } else if (error.request) {

            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                const timeoutRejection = {
                    message: 'Request timed out. The server may be slow or the database connection may be hanging. Please check server logs and database connectivity.',
                    code: 'TIMEOUT',
                    request: error.request,
                };
                if (!isSilentError && typeof window !== 'undefined') {
                    toast({
                        title: 'Request timed out',
                        description: timeoutRejection.message,
                        variant: 'destructive',
                    });
                }
                return Promise.reject(timeoutRejection);
            }

            const networkRejection = {
                message: `No response from server. Please check if the backend is running (${apiOriginForErrors}) and the database is connected.`,
                request: error.request,
            };
            if (!isSilentError && typeof window !== 'undefined') {
                toast({
                    title: 'Connection problem',
                    description: networkRejection.message,
                    variant: 'destructive',
                });
            }
            return Promise.reject(networkRejection);
        } else {
            // Something else happened
            return Promise.reject({ message: error.message || 'An error occurred' });
        }
    }
);

export default axiosInstance;

