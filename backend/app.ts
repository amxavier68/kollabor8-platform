const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const apiVersions = require('./config/api-versions');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// API version deprecation middleware
app.use('/api/:version', (req, res, next) => {
  const version = req.params.version;
  const versionConfig = apiVersions.versions[version];
  
  if (!versionConfig) {
    return res.status(404).json({
      error: 'API version not found',
      availableVersions: Object.keys(apiVersions.versions)
    });
  }
  
  if (versionConfig.deprecated && apiVersions.deprecation.headers) {
    const daysUntilSunset = versionConfig.sunsetDate 
      ? Math.ceil((new Date(versionConfig.sunsetDate) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    
    res.set({
      'X-API-Deprecated': 'true',
      'X-API-Sunset-Date': versionConfig.sunsetDate || 'TBD',
      'X-API-Days-Until-Sunset': daysUntilSunset,
      'X-API-Migration-Guide': `https://docs.kollabor8.com/migration/${version}`
    });
  }
  
  next();
});

// Version routes
const v1Routes = require('./api/v1/routes');
const v2Routes = require('./api/v2/routes');

app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Default version redirect
app.use('/api', (req, res) => {
  res.redirect(`/api/${apiVersions.default}${req.url}`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    versions: apiVersions.versions
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;