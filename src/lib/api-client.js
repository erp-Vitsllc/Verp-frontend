/**
 * Optimized client-side API utility
 * Includes request deduplication and caching
 */

import axiosInstance from '@/utils/axios';

// Request cache and deduplication
const requestCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Create a cache key from request config
 */
function getCacheKey(url, params = {}) {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
    return `${url}?${sortedParams}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cacheEntry) {
    return Date.now() - cacheEntry.timestamp < CACHE_TTL;
}

/**
 * Optimized GET request with caching and deduplication
 */
export async function apiGet(url, config = {}) {
    const { params = {}, useCache = true, ...axiosConfig } = config;
    const cacheKey = getCacheKey(url, params);

    // Check cache first
    if (useCache && requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (isCacheValid(cached)) {
            return cached.data;
        }
        requestCache.delete(cacheKey);
    }

    // Check if same request is already pending (deduplication)
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey);
    }

    // Make the request
    const requestPromise = axiosInstance.get(url, { params, ...axiosConfig })
        .then(response => {
            // Cache successful responses
            if (useCache && response.data) {
                requestCache.set(cacheKey, {
                    data: response.data,
                    timestamp: Date.now(),
                });
            }
            pendingRequests.delete(cacheKey);
            return response.data;
        })
        .catch(error => {
            pendingRequests.delete(cacheKey);
            throw error;
        });

    pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
}

/**
 * Clear cache for a specific URL pattern
 */
export function clearCache(pattern = null) {
    if (!pattern) {
        requestCache.clear();
        return;
    }

    for (const key of requestCache.keys()) {
        if (key.includes(pattern)) {
            requestCache.delete(key);
        }
    }
}

/**
 * Optimized POST request
 */
export async function apiPost(url, data, config = {}) {
    const response = await axiosInstance.post(url, data, config);
    // Clear related cache on mutations
    clearCache(url.split('/')[1]); // Clear cache for the resource type
    return response.data;
}

/**
 * Optimized PATCH request
 */
export async function apiPatch(url, data, config = {}) {
    const response = await axiosInstance.patch(url, data, config);
    clearCache(url.split('/')[1]);
    return response.data;
}

/**
 * Optimized DELETE request
 */
export async function apiDelete(url, config = {}) {
    const response = await axiosInstance.delete(url, config);
    clearCache(url.split('/')[1]);
    return response.data;
}




