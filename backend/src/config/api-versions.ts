interface ApiVersionConfig {
  status: 'stable' | 'beta' | 'deprecated';
  deprecated: boolean;
  sunsetDate: string | null;
  features: string[];
}

interface ApiVersions {
  [key: string]: ApiVersionConfig;
}

export const apiVersions: ApiVersions = {
  v1: {
    status: 'stable',
    deprecated: false,
    sunsetDate: null,
    features: ['auth', 'licenses', 'plugins']
  },
  v2: {
    status: 'beta',
    deprecated: false,
    sunsetDate: null,
    features: ['auth', 'licenses', 'plugins', 'analytics']
  }
};

export const defaultVersion = 'v1';

export const deprecationConfig = {
  warningPeriod: 90,
  headers: true
};
