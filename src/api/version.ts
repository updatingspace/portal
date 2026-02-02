import { request } from './client';

export interface VersionInfo {
  build_id: string;
  api_version: string;
}

/**
 * Fetch version information from the backend API
 */
export async function fetchBackendVersion(): Promise<VersionInfo> {
  return request<VersionInfo>('/version');
}
