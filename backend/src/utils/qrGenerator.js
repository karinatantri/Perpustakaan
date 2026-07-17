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

    // Convert data URL to buffer
    const base64Data = qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'png',
          public_id: `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

module.exports = {
  generateAndUploadQR
};

