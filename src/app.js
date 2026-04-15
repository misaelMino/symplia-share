const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { corsOrigin } = require('./config/env');
const resolveAuthUser = require('./middlewares/resolveAuthUser');
const requireAuthUser = require('./middlewares/requireAuthUser');
const privateShareRoutes = require('./routes/privateShareRoutes');
const publicShareRoutes = require('./routes/publicShareRoutes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');

const app = express();

app.use(cors({
  origin: corsOrigin === '*'
    ? '*'
    : corsOrigin.split(',').map((item) => item.trim()).filter(Boolean),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Share-Pin-Token', 'X-User-Id', 'X-Auth-User-Sub', 'X-Auth-User-Claims']
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(resolveAuthUser);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'symplia-share', status: 'UP' });
});

app.use('/api', requireAuthUser, privateShareRoutes);
app.use('/public', publicShareRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
