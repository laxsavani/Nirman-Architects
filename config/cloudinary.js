const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables or fallback
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Uploads buffer directly to Cloudinary using upload_stream
 * @param {Buffer} fileBuffer - Image buffer from Multer
 * @param {object} options - Cloudinary options (folder, public_id, format)
 */
function uploadToCloudinary(fileBuffer, options = {}) {
  return new Promise((resolve) => {
    // Check if Cloudinary is configured
    const hasConfig = (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) || process.env.CLOUDINARY_URL;
    if (!hasConfig) {
      console.log('[Cloudinary] Cloudinary env vars not set. Local storage saved as primary.');
      return resolve(null);
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        overwrite: true,
        invalidate: true,
        ...options
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Warning]', error.message || error);
          return resolve(null); // Fallback gracefully if upload fails
        }
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
}

module.exports = {
  cloudinary,
  uploadToCloudinary
};
