const QRCode = require('qrcode');
const { cloudinary } = require('../cloudinary');

/**
 * Generate QR code image and upload to Cloudinary
 * @param {string} text - Text to encode in QR code
 * @param {string} folder - Cloudinary folder path (optional)
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function generateAndUploadQR(text, folder = 'library-qrcodes') {
  try {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(text, {
      // M = 15% ECC, cukup untuk label fisik tanpa membuat kode terlalu padat
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      // Quiet zone min. 4 module agar pemindaian stabil (default lib = 4)
      margin: 4,
      // Sedikit lebih besar untuk cetak & layar
      width: 360
    });

    // Try Cloudinary upload if configured
    try {
      if (cloudinary && cloudinary.config().cloud_name) {
        const base64Data = qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: 'image',
              format: 'png',
              public_id: `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(buffer);
        });

        if (uploadResult && uploadResult.secure_url) {
          return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id
          };
        }
      }
    } catch (uploadErr) {
      console.warn('Cloudinary upload failed or unconfigured, falling back to data URL QR:', uploadErr.message);
    }

    // Reliable fallback: return data URL directly so QR code is always available
    return {
      url: qrDataUrl,
      publicId: null
    };
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

module.exports = {
  generateAndUploadQR
};
