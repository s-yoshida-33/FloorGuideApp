import { APP_CONFIG } from '../config';
import { logError } from '../logs/logging';

export interface CmsSchedule {
  id: string;
  name: string;
  current_programs?: CmsProgram[];
}

export interface CmsProgram {
  id: string;
  name: string;
  items?: CmsProgramItem[];
}

export interface CmsProgramItem {
  id: string;
  duration: number;
  sequence?: number;
  // Assuming the item might have media details or a URL
  // We'll inspect the actual response to refine this
  media?: {
    id: string;
    url: string;
    media_type: string;
    filename: string;
  };
}

export interface DeviceStatus {
  // Screen properties
  id: string;
  name: string;
  status: string;
  current_schedule?: CmsSchedule;
  download_bandwidth_limit?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

class CmsClient {
  private accessToken: string | null = null;
  private tokenExpiration: number = 0;

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiration) {
      return this.accessToken;
    }

    const { clientId, clientSecret } = APP_CONFIG.cmsAuth;
    // APP_CONFIG.cmsApiBaseUrl is "https://api-jp.wonder-screen.com/api"
    // We need "https://api-jp.wonder-screen.com/oauth/token"
    const baseUrl = APP_CONFIG.cmsApiBaseUrl.replace(/\/api\/?$/, '');
    const url = `${baseUrl}/oauth/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'cms-scope'); // Explicitly requesting cms-scope

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // expires_in is in seconds
      this.tokenExpiration = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
      
      return this.accessToken!;
    } catch (error) {
      logError('api', 'Failed to authenticate', { error });
      throw error;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (e) {
      // If we can't get a token, we can't make the request
      throw new ApiError('Authentication failed', 401);
    }

    const url = `${APP_CONFIG.cmsApiBaseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    } as HeadersInit;

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        // If 401 Unauthorized, token might be expired despite our check.
        // In a more robust implementation, we would retry once after refreshing token.
        if (response.status === 401) {
            this.accessToken = null;
            logError('api', 'Token rejected (401), clearing token cache.');
        }
        throw new ApiError(`CMS API Error: ${response.status} ${response.statusText}`, response.status);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return {} as T;
    } catch (error) {
      logError('api', `Request failed: ${path}`, { error });
      throw error;
    }
  }

  async getDeviceStatus(deviceCode: string): Promise<DeviceStatus | null> {
    try {
      // Response wrapper: { data: DeviceStatus }
      const response = await this.request<{ data: DeviceStatus }>(`/devices/${deviceCode}/status`);
      return response.data;
    } catch (error: any) {
      // If 404, throw to caller so they can handle invalid code
      if (error.status === 404) {
        throw error;
      }
      // Logged in request method
      return null;
    }
  }

  async generateDeviceCode(): Promise<{ code: string; verifyExpiredAt: string } | null> {
    try {
      // POST /generate-device-code
      const response = await this.request<{ data: any }>('/generate-device-code', {
        method: 'POST',
      });
      
      // Handle various response formats
      if (response && response.data) {
        const { code, verifyExpiredAt } = response.data;
        if (typeof code === 'string' && typeof verifyExpiredAt === 'string') {
           return { code, verifyExpiredAt };
        }
        // Fallback for older API or different format if needed, but primarily we expect object
        if (typeof response.data === 'string') {
            // If API returns just string, we don't have expiration.
            // But based on demo, it returns object.
            return { code: response.data, verifyExpiredAt: '' };
        }
      }
      
      logError('api', 'Unknown response format for generateDeviceCode', { response });
      return null;
    } catch (error) {
      logError('api', 'Failed to generate device code', { error });
      return null;
    }
  }
}

export const cmsClient = new CmsClient();
