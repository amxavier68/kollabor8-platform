export interface LicenseValidationRequest {
  license_key: string;
  domain: string;
  plugin_slug: string;
  plugin_version: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  license: {
    key: string;
    status: 'active' | 'expired' | 'suspended';
    expires_at?: string;
  };
}
