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

  // CORS: Mengizinkan SEMUA origin agar proses login / akses API dari Vercel/localhost terjamin tanpa error
  const corsOptions = {
    // origin: true akan memantulkan origin dari request pengirim, sehingga semua diizinkan dengan kredensial
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200
  };

  // Pastikan preflight CORS (`OPTIONS`) selalu dijawab (sering jadi penyebab "Network Error" di axios).
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

  // Public stats endpoint for landing page (no auth required)
  app.get('/api/public/stats', async (req, res) => {
    try {
      const db = getFirestore();
      const [transactionsSnap, studentsSnap] = await Promise.all([
        db.collection('transactions').get(),
        db.collection('students').get()
      ]);

      const transactions = [];
      transactionsSnap.forEach(doc => {
        transactions.push(doc.data());
      });
      const totalStudents = studentsSnap.size;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const booksToday = transactions.filter((t) => {
        if (!t.borrowDate) return false;
        const borrowDate = new Date(t.borrowDate);
        return borrowDate >= today && borrowDate <= todayEnd;
      }).length;

      const activeStudentIds = new Set(
        transactions
          .filter((t) => t.status === 'ongoing')
          .map((t) => t.studentId)
          .filter(Boolean)
      );
      
      const activeStudents = activeStudentIds.size || totalStudents;

      const overdue = transactions.filter((t) => {
        if (t.status !== 'ongoing' || !t.dueDate) return false;
        return new Date(t.dueDate) < new Date();
      }).length;

      res.json({
        booksToday,
        activeStudents,
        overdueBooks: overdue
      });
    } catch (err) {
      console.error('Failed to get public stats:', err);
      res.status(500).json({ message: 'Failed to load statistics' });
    }
  });

  // Routers
  // Menggunakan require di dalam blok try untuk memastikan module-level error tertangkap
  app.use('/api/students', require('./routes/students'));
  app.use('/api/books', require('./routes/books'));
  app.use('/api/items', require('./routes/items'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/inventories', require('./routes/inventories'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found Endpoint', path: req.path });
  });

  // Global Error Handler untuk Express (Menangkap Error 500 bawaan yang bersifat HTML)
  app.use((err, req, res, next) => {
    console.error('Express Critical Error:', err);
    res.status(500).json({
      error: 'Internal Express Error',
      message: err.message,
      stack: err.stack,
      hint: 'Terjadi kegagalan fungsi di dalam Express, kemungkinan data tidak valid atau bug.'
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
