# 🗄️ Cache Management untuk Production

## ⚠️ Penting: Hard Refresh Hanya untuk Development

**Hard refresh (`Ctrl + Shift + R`) hanya diperlukan saat development lokal.** 

Di production, aplikasi sudah dilengkapi dengan:
- ✅ Service Worker dengan auto-update
- ✅ Cache versioning otomatis
- ✅ Network-first strategy untuk API calls
- ✅ Auto-cleanup cache lama

## 🔄 Cara Kerja Cache di Production

### **1. Service Worker Auto-Update**

Setiap kali Anda deploy versi baru:
1. Service Worker baru akan terinstall
2. Cache lama otomatis dihapus
3. User akan dapat notifikasi untuk reload (opsional)
4. Aplikasi akan reload otomatis jika user setuju

### **2. Cache Strategy**

**Static Assets (HTML, CSS, JS):**
- Network First → Cache Fallback
- Jika online: ambil dari network, update cache
- Jika offline: gunakan cache

**API Calls:**
- Network Only (tidak di-cache)
- Selalu ambil data terbaru dari server

**Images & Fonts:**
- Cache dengan versioning
- Auto-update saat ada perubahan

### **3. Cache Versioning**

Setiap deploy baru, update `CACHE_NAME` di `sw.js`:
```javascript
const CACHE_NAME = 'perpustakaan-cache-v7'; // Update versi ini
```

## 🚀 Update Cache untuk Deploy Baru

### **Step 1: Update Cache Version**

Edit `frontend/public/sw.js`:
```javascript
const CACHE_NAME = 'perpustakaan-cache-v7'; // Increment versi
```

### **Step 2: Build & Deploy**

```bash
cd frontend
npm run build
# Deploy ke Vercel/Netlify
```

### **Step 3: User Experience**

**Otomatis:**
- Service Worker baru terinstall
- Cache lama dihapus
- User dapat notifikasi update (opsional)
- Aplikasi reload dengan versi baru

**Manual (jika perlu):**
- User bisa clear cache di browser settings
- Atau hard refresh sekali (`Ctrl + Shift + R`)

## 🛡️ Mencegah Error Cache di Production

### **1. API Calls Tidak Di-Cache**

Semua API calls (`/api/*`) tidak di-cache, jadi:
- ✅ Data selalu fresh
- ✅ Tidak ada masalah dengan data lama
- ✅ Token authentication selalu valid

### **2. Cache Invalidation**

Service Worker otomatis:
- ✅ Hapus cache lama saat update
- ✅ Install cache baru
- ✅ Claim clients untuk update langsung

### **3. Versioning Assets**

Vite otomatis menambahkan hash ke file assets:
- `main.js` → `main-abc123.js`
- `styles.css` → `styles-xyz789.css`

Jadi browser otomatis load versi baru tanpa cache issue.

## 📋 Checklist Sebelum Deploy

- [ ] Update `CACHE_NAME` di `sw.js` (increment versi)
- [ ] Test build lokal (`npm run build`)
- [ ] Test preview (`npm run preview`)
- [ ] Deploy ke hosting
- [ ] Test di production:
  - [ ] Clear cache browser sekali
  - [ ] Test semua fitur
  - [ ] Test offline mode
  - [ ] Test update notification

## 🔧 Troubleshooting Cache Issues

### **Problem: User masih lihat versi lama**

**Solution:**
1. Update `CACHE_NAME` di `sw.js`
2. Deploy ulang
3. User akan dapat notifikasi update

### **Problem: API calls di-cache**

**Solution:**
- Sudah di-handle: API calls tidak di-cache
- Cek `NO_CACHE_PATTERNS` di `sw.js`

### **Problem: Assets tidak update**

**Solution:**
- Vite otomatis handle dengan hash
- Pastikan build baru di-deploy
- Clear cache sekali di browser

## ✅ Best Practices

1. **Update Cache Version Setiap Deploy**
   - Increment `CACHE_NAME` di `sw.js`
   - Commit perubahan

2. **Test Cache Strategy**
   - Test offline mode
   - Test update flow
   - Test API calls (harus selalu fresh)

3. **Monitor Service Worker**
   - Cek Console untuk SW logs
   - Monitor cache size
   - Monitor update success rate

4. **User Communication**
   - Optional: Show update notification
   - Explain offline capabilities
   - Provide manual refresh option

## 🎯 Kesimpulan

**Tidak perlu khawatir tentang cache di production!**

- ✅ Service Worker handle cache otomatis
- ✅ API calls tidak di-cache (selalu fresh)
- ✅ Assets di-version dengan hash
- ✅ Cache lama auto-cleanup
- ✅ Update flow sudah di-handle

**User hanya perlu:**
- Clear cache sekali setelah deploy pertama (opsional)
- Atau biarkan service worker handle otomatis

---

**Hard refresh hanya untuk development. Di production, semua sudah otomatis! 🚀**



