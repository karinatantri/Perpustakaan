const { getFirestore } = require('../firebase');

/**
 * Ensures all teacher accounts from `users` collection exist in `students` (members) collection,
 * and that each teacher's user document has `studentId` pointing to their member document.
 */
async function syncTeachers() {
  try {
    const db = getFirestore();
    const usersCol = db.collection('users');
    const studentsCol = db.collection('students');

    const teachersSnap = await usersCol.where('role', '==', 'teacher').get();
    if (teachersSnap.empty) {
      console.log('[SYNC TEACHERS] No teacher accounts found in users collection.');
      return { synced: 0 };
    }

    let syncedCount = 0;
    const now = new Date().toISOString();

    for (const userDoc of teachersSnap.docs) {
      const userData = userDoc.data();
      let memberId = userData.studentId;

      // 1. Check if user already has valid studentId pointing to existing doc
      if (memberId) {
        const memberDoc = await studentsCol.doc(memberId).get();
        if (memberDoc.exists) {
          const mData = memberDoc.data();
          const updates = {};
          if (mData.role !== 'teacher') updates.role = 'teacher';
          if (userData.name && mData.name !== userData.name) updates.name = userData.name;
          if (userData.homeroomClass && mData.class !== userData.homeroomClass) {
            updates.class = userData.homeroomClass;
          }
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = now;
            await studentsCol.doc(memberId).update(updates);
          }
          continue;
        }
      }

      // 2. Search if member doc already exists by nis == username or name == user.name
      let existingMemberSnap = await studentsCol.where('nis', '==', userData.username).limit(1).get();
      if (existingMemberSnap.empty && userData.name) {
        existingMemberSnap = await studentsCol
          .where('role', '==', 'teacher')
          .where('name', '==', userData.name)
          .limit(1)
          .get();
      }

      if (!existingMemberSnap.empty) {
        const foundDoc = existingMemberSnap.docs[0];
        memberId = foundDoc.id;
        await studentsCol.doc(memberId).update({
          role: 'teacher',
          name: userData.name || foundDoc.data().name,
          class: userData.homeroomClass || foundDoc.data().class || '-',
          updatedAt: now
        });
      } else {
        // 3. Create new member document for this teacher
        const newDocRef = await studentsCol.add({
          nis: userData.username,
          name: userData.name || userData.username,
          class: userData.homeroomClass || '-',
          major: 'Guru',
          role: 'teacher',
          status: 'active',
          createdAt: userData.createdAt || now,
          updatedAt: now
        });
        memberId = newDocRef.id;
      }

      // 4. Update user document with the linked studentId
      await userDoc.ref.update({
        studentId: memberId,
        updatedAt: now
      });

      syncedCount++;
    }

    console.log(`[SYNC TEACHERS] Successfully synced ${syncedCount} teacher account(s) to member data.`);
    return { synced: syncedCount };
  } catch (err) {
    console.error('[SYNC TEACHERS] Error during teacher sync:', err);
    throw err;
  }
}

module.exports = {
  syncTeachers
};

