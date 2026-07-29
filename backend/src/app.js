const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
let app = express();

try {
  const { configureCloudinary } = require('./cloudinary');
  const { getFirestore } = require('./firebase');
  
  dotenv.config();
  configureCloudinary();
  getFirestore(); // ensure initialized

  // Security headers with Helmet
  try {
    const helmet = require('helmet');
    app.use(helmet({
      contentSecurityPolicy: false, // allow inline scripts/images from external CDNs (Cloudinary, etc.)
      crossOriginEmbedderPolicy: false
    }));
  } catch (_) {
    console.warn('Helmet package not loaded, skipping security headers');
  }

  // Response compression
  try {
    const compression = require('compression');
    app.use(compression());
  } catch (_) {
    console.warn('Compression package not loaded');
  }

  // Rate Limiting
  try {
    const rateLimit = require('express-rate-limit');
    
    // Global API rate limiter: max 300 requests per 15 minutes per IP
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Terlalu banyak permintaan dari IP ini, coba lagi setelah 15 menit.' }
    });
    app.use('/api', apiLimiter);

    // Auth rate limiter: max 15 login attempts per 15 minutes per IP
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 15,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' }
    });
    app.use('/api/auth/login', authLimiter);
  } catch (_) {
    console.warn('express-rate-limit package not loaded');
  }

  // CORS Configuration
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      // In development or production, allow the request
      return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200
  };

  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Perpustakaan API - Backend is running',
      status: 'ok',
      time: new Date().toISOString(),
      endpoints: {
        health: '/health',
        api: '/api'
      }
    });
  });

  // Simple health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  // Prefixed health for serverless path /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Root API endpoint listing
  app.get('/api', (req, res) => {
    res.json({ 
      message: 'Perpustakaan API - Backend is running',
      status: 'ok',
      time: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        publicStats: '/api/public/stats',
        students: '/api/students',
        books: '/api/books',
        items: '/api/items',
        transactions: '/api/transactions',
        inventories: '/api/inventories',
        auth: '/api/auth',
        users: '/api/users'
      }
    });
  });

  // Public stats endpoint for landing page (optimized query)
  app.get('/api/public/stats', async (req, res) => {
    try {
      const db = getFirestore();
      const [studentsCountSnap, ongoingTxSnap] = await Promise.all([
        db.collection('students').count().get(),
        db.collection('transactions').where('status', '==', 'ongoing').get()
      ]);

      const totalStudents = studentsCountSnap.data().count;
      const today = new Date();

      let activeStudentsCount = 0;
      let overdueBooksCount = 0;
      const activeStudentIds = new Set();

      ongoingTxSnap.forEach(doc => {
        const tx = doc.data();
        if (tx.studentId) activeStudentIds.add(tx.studentId);
        if (tx.dueDate && new Date(tx.dueDate) < today) {
          overdueBooksCount++;
        }
      });

      activeStudentsCount = activeStudentIds.size || totalStudents;

      res.json({
        booksToday: ongoingTxSnap.size,
        activeStudents: activeStudentsCount,
        overdueBooks: overdueBooksCount
      });
    } catch (err) {
      console.error('Failed to get public stats:', err);
      res.status(500).json({ message: 'Failed to load statistics' });
    }
  });

  // Routers
  app.use('/api/students', require('./routes/students'));
  app.use('/api/books', require('./routes/books'));
  app.use('/api/items', require('./routes/items'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/inventories', require('./routes/inventories'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/notifications', require('./routes/notifications'));

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found Endpoint', path: req.path });
  });

  // Global Error Handler untuk Express (SEC-2: Suppress stack trace in production)
  app.use((err, req, res, next) => {
    console.error('Express Critical Error:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Internal Express Error',
      message: err.message,
      ...(isDev ? { stack: err.stack } : {})
    });
  });

} catch (bootstrapError) {
  console.error("FATAL INITIALIZATION ERROR:", bootstrapError);
  // Jika server gagal diinisialisasi (misal Firebase gagal, JWT_SECRET kurang),
  // secara eksplisit ambil alih SEMUA request termasuk metode POST
  app.use('*', (req, res) => {
    res.status(500).json({
      error: "API Bootstrap Failed",
      message: bootstrapError.message,
      instruction: "Terdapat masalah pada Environment Variable atau kunci konfigurasi. Harap pantau tab Function Logs Vercel."
    });
  });
}

// Handler super terakhir saat Vercel mencoba run serverless logic di luar context app
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;
