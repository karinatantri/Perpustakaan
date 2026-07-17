const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const { getFirestore } = require('./src/firebase');

const db = getFirestore();
const usersCol = db.collection('users');

const seedUsers = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator Kepala' },
  { username: 'petugas', password: 'petugas123', role: 'officer', name: 'Petugas Pustakawan' },
  { username: 'magang', password: 'magang123', role: 'intern', name: 'Siswa PKL/Magang' },
  { username: 'guru', password: 'guru123', role: 'teacher', name: 'Guru Pengajar' },
  { username: 'siswa', password: 'siswa123', role: 'student', name: 'Murid Siswa' },
  { username: 'kepsek', password: 'kepsek123', role: 'principal', name: 'Kepala Sekolah (H. Sunardi)' }
];

async function seed() {
  console.log('Starting seeding process...');
  for (const user of seedUsers) {
    try {
      const snap = await usersCol.where('username', '==', user.username).limit(1).get();
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      if (!snap.empty) {
        const docId = snap.docs[0].id;
        await usersCol.doc(docId).update({
          passwordHash,
          role: user.role,
          name: user.name,
          updatedAt: new Date().toISOString()
        });
        console.log(`✓ Updated existing user "${user.username}" (role: ${user.role}) with new password`);
        continue;
      }
      
      const docRef = await usersCol.add({
        username: user.username,
        passwordHash,
        role: user.role,
        name: user.name,
        createdAt: new Date().toISOString()
      });
      console.log(`✓ Created user "${user.username}" (role: ${user.role}) with ID: ${docRef.id}`);
    } catch (err) {
      console.error(`Error creating user "${user.username}":`, err.message);
    }
  }
  console.log('Seeding process finished.');
  process.exit(0);
}

seed();
