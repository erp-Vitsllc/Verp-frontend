import {
    attachRequestToActionGuard,
    completeActionGuardRequest,
} from '@/utils/actionClickGuardCore';

const inFlightMutationKeys = new Map();

function mutationRequestKey(config) {
    const method = String(config.method || 'get').toUpperCase();
    const url = String(config.url || '');
    let body = '';
    try {
        if (config.data instanceof FormData) {
            body = 'form-data';
        } else if (config.data != null) {
            body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
        }
    } catch {
        body = 'unserializable';
    }
    return `${method}:${url}:${body}`;
}

/**
 * Register axios interceptors for action-guard sessions and duplicate mutation blocking.
 * @param {import('axios').AxiosInstance} axiosInstance
 */
export function registerActionGuardInterceptors(axiosInstance) {
    axiosInstance.interceptors.request.use(
        (config) => {
            attachRequestToActionGuard(config);

            const method = String(config.method || 'get').toLowerCase();
            if (method === 'get' || method === 'head' || config.skipActionDedupe) {
                return config;
            }

            const key = mutationRequestKey(config);
            if (inFlightMutationKeys.has(key)) {
                const error = new Error('Duplicate request blocked');
                error.code = 'ACTION_DEDUPED';
                error.config = config;
                return Promise.reject(error);
            }

            inFlightMutationKeys.set(key, true);
            config._actionDedupeKey = key;
            return config;
        },
        (error) => Promise.reject(error),
    );

    const resolveGuardConfig = (error) => error?.config || error?.originalError?.config;

    const releaseDedupe = (config) => {
        const key = config?._actionDedupeKey;
        if (key) inFlightMutationKeys.delete(key);
        completeActionGuardRequest(config);
    };

    axiosInstance.interceptors.response.use(
        (response) => {
            releaseDedupe(response.config);
            return response;
        },
        (error) => {
            releaseDedupe(resolveGuardConfig(error));
            if (error?.code === 'ACTION_DEDUPED') {
                return Promise.reject({
                    ...error,
                    silent: true,
                    message: 'Duplicate request blocked',
                });
            }
            return Promise.reject(error);
        },
    );
}
