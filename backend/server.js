const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { port, corsOrigin, uploadDir, jwtSecret } = require('./config/env');
const jwt = require('jsonwebtoken');
const { testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const billingRoutes = require('./routes/billingRoutes');
const splitBillRoutes = require('./routes/splitBillRoutes');
const tableRoutes = require('./routes/tableRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notFoundMiddleware = require('./middleware/notFound');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const visitRoutes = require('./routes/visitRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

// Normal API traffic, including dashboard polling.
// Shorter window prevents a long lockout during normal use.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a minute and try again.',
  },
});

// Separate protection for login attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many unsuccessful sign-in attempts. Please try again in 15 minutes.',
  },
});

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan('dev'));
app.use('/api', (req, res, next) => {
  // Login has its own limit, independent of dashboard requests.
  if (req.method === 'POST' && req.path === '/auth/login') {
    return next();
  }

  return apiLimiter(req, res, next);
});

app.post('/api/auth/login', loginLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Only menu images may be accessed through the public uploads URL.
// Invoices must use the protected PDF download endpoints.
const publicImageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

app.use(
  '/uploads',
  (req, res, next) => {
    const extension = path.extname(req.path).toLowerCase();

    if (!publicImageExtensions.has(extension)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    next();
  },
  express.static(path.join(__dirname, uploadDir), {
    index: false,
    dotfiles: 'deny',
  })
);

app.get('/health', (_req, res) => res.json({ ok: true, message: 'Backend is running' }));
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bills', billingRoutes);
app.use('/api/split-bill', splitBillRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/visits', visitRoutes);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// Only authenticated managers are allowed to hold a live socket connection -
// the customer app never connects here, it polls REST for its own order
// status instead. The manager dashboard sends its JWT access token as
// `auth: { token }` when it calls io('...', { auth: { token } }).
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, jwtSecret);
    socket.managerId = decoded.id;
    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  socket.join(`manager:${socket.managerId}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.locals.io = io;

async function startServer() {
  try {
    const connected = await testConnection();
    if (connected) {
      console.log('PostgreSQL connection successful');
    }
  } catch (error) {
    console.warn('PostgreSQL connection unavailable; continuing with startup.', error.message);
  }

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
