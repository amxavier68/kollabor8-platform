export const apiVersions = {
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
