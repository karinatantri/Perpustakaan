const admin = require('firebase-admin');
const path = require('path');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  // In production, use environment variables (RECOMMENDED)
  // Supports multiple options:
  // 1) Individual fields: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
  // 2) Full JSON string: FIREBASE_SERVICE_ACCOUNT
  // 3) File path: GOOGLE_APPLICATION_CREDENTIALS (for local development only)
  // 4) Fallback: applicationDefault() (for GCP environments)

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    // Option 1: Individual fields (RECOMMENDED for production)
    if (projectId && privateKey && clientEmail) {
      // Bersihkan privateKey bila ter-paste dengan kutip (") dari Vercel
      let formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      formattedPrivateKey = formattedPrivateKey.replace(/^"|"$/g, '');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          privateKey: formattedPrivateKey,
          clientEmail: clientEmail
        })
      });
      console.log('✓ Firebase initialized using individual env variables');
    }
    // Option 2: Full JSON string from env
    else if (serviceAccountJson && serviceAccountJson.trim()) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✓ Firebase initialized using FIREBASE_SERVICE_ACCOUNT JSON');
      } catch (parseErr) {
        console.warn('⚠️  Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
        throw parseErr;
      }
    }
    // Option 3: File path (for local development only)
    else if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
      const fullPath = path.resolve(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(fullPath)
      });
      console.log('✓ Firebase initialized using service account file:', fullPath);
    }
    // Opsi 4: TIDAK ADA KREDENSIAL / ERROR (Mencegah `applicationDefault()` GCP bawaan Vercel)
    else {
      throw new Error(
        `Firebase Credentials ERROR! Salah satu env berikut kosong/belum tersimpan di Vercel: ` +
        `PROJECT_ID: ${!!projectId}, CLIENT_EMAIL: ${!!clientEmail}, PRIVATE_KEY: ${!!privateKey}`
      );
    }
  } catch (err) {
    console.error('❌ Firebase initialization error:', err.message);
    console.error('\n📋 Setup Instructions:');
    console.error('   1. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env');
    console.error('   2. OR set FIREBASE_SERVICE_ACCOUNT with full JSON string');
    console.error('   3. OR set GOOGLE_APPLICATION_CREDENTIALS for local development');
    throw err;
  }

  initialized = true;
  return admin;
}

function getFirestore() {
  const app = initFirebase();
  return app.firestore();
}

module.exports = {
  initFirebase,
  getFirestore
};


