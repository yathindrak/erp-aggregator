import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { ErpRateLimitError, ErpAuthError } from "../../api-utils";

export function createApiClient(config: AxiosRequestConfig): AxiosInstance {
    const instance = axios.create(config);

    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const { config, response } = error;

            // Retry on 429 Rate Limit
            if (response && response.status === 429) {
                const retryCount = (config as any)._retryCount || 0;
                if (retryCount < 3) {
                    (config as any)._retryCount = retryCount + 1;

                    // Exponential backoff
                    const delay = Math.pow(2, retryCount) * 1000;
                    console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1})...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    return instance(config);
                }
                return Promise.reject(new ErpRateLimitError());
            }

            if (response && response.status === 401) {
                return Promise.reject(new ErpAuthError());
            }

            return Promise.reject(error);
        }
    );

    return instance;
}
