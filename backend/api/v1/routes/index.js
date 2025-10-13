const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const licenseRoutes = require('./license.routes');
const pluginRoutes = require('./plugin.routes');

// Version info endpoint
router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    status: 'stable',
    endpoints: {
      auth: '/api/v1/auth',
      licenses: '/api/v1/licenses',
      plugins: '/api/v1/plugins'
    },
    documentation: 'https://docs.kollabor8.com/api/v1'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/licenses', licenseRoutes);
router.use('/plugins', pluginRoutes);

module.exports = router;