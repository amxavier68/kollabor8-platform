import 'reflect-metadata';
import apiService from './api.service';
import { License, ApiResponse } from '@types/index';
import { Log, Measure, Cache, Injectable } from '@decorators/index';

@Injectable()
class LicenseService {
  @Log
  @Measure
  async validateLicense(
    licenseKey: string,
    domain: string,
    pluginSlug: string
  ): Promise<ApiResponse> {
    return apiService.post('/licenses/validate', {
      license_key: licenseKey,
      domain,
      plugin_slug: pluginSlug,
      plugin_version: '1.0.0',
    });
  }

  @Log
  @Measure
  @Cache(30000) // Cache for 30 seconds
  async getUserLicenses(): Promise<ApiResponse<License[]>> {
    return apiService.get<License[]>('/licenses');
  }

  @Log
  @Measure
  async createLicense(data: Partial<License>): Promise<ApiResponse<License>> {
    return apiService.post<License>('/licenses', data);
  }

  @Log
  @Measure
  async updateLicense(id: string, data: Partial<License>): Promise<ApiResponse<License>> {
    return apiService.put<License>(`/licenses/${id}`, data);
  }

  @Log
  @Measure
  async deleteLicense(id: string): Promise<ApiResponse> {
    return apiService.delete(`/licenses/${id}`);
  }
}

export default new LicenseService();
