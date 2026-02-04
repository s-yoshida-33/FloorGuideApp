import { APP_CONFIG } from '../config';
import { logError, logInfo } from '../logs/logging';

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

class CmsClient {
  private getAuthHeader(): string {
    const { username, password } = APP_CONFIG.cmsAuth;
    return 'Basic ' + btoa(`${username}:${password}`);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${APP_CONFIG.cmsApiBaseUrl}${path}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    } as HeadersInit;

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`CMS API Error: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return {} as T;
    } catch (error) {
      logError('api', `Request failed: ${path}`, error as Error);
      throw error;
    }
  }

  async getDeviceStatus(deviceCode: string): Promise<DeviceStatus | null> {
    try {
      // Response wrapper: { data: DeviceStatus }
      const response = await this.request<{ data: DeviceStatus }>(`/devices/${deviceCode}/status`);
      return response.data;
    } catch (error) {
      // Logged in request method
      return null;
    }
  }
}

export const cmsClient = new CmsClient();
