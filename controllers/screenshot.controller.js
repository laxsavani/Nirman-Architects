const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const Screenshot = require('../models/Screenshot');
const ScreenshotConfig = require('../models/ScreenshotConfig');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { getScreenshotPath, getStorageRoot, safeResolvePath } = require('../utils/storagePathResolver');
const { uploadToCloudinary } = require('../config/cloudinary');

// Multer memory storage configuration (in-memory buffer processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max file size limit
});

/**
 * Handle multipart screenshot upload from Electron Agent
 */
const uploadScreenshot = async (req, res) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id || req.user._id)) || req.body.userId;
    const { attendanceId, isFirstOfSession, isOfflineSync } = req.body;

    console.log(`[Screenshot Controller] Received upload request: userId=${userId}, attendanceId=${attendanceId}, hasFile=${!!req.file}`);

    if (!userId || !attendanceId) {
      console.warn('[Screenshot Controller] Rejecting: Missing userId or attendanceId.');
      return res.status(400).json({ success: false, message: 'userId and attendanceId are required.' });
    }

    if (!req.file || !req.file.buffer) {
      console.warn('[Screenshot Controller] Rejecting: Missing screenshot image file.');
      return res.status(400).json({ success: false, message: 'Screenshot image file is required.' });
    }

    // Validate active attendance session
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      console.warn(`[Screenshot Controller] Rejecting: Attendance session ${attendanceId} not found.`);
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    const attendanceUserId = String(attendance.userId || attendance.employeeId);
    if (attendanceUserId !== String(userId)) {
      console.warn(`[Screenshot Controller] Mismatch: Attendance userId (${attendanceUserId}) !== token userId (${userId})`);
      return res.status(403).json({ success: false, message: 'Attendance session does not match user.' });
    }

    // Fetch user details for name formatting e.g. "Bhakti Kadam" -> "Bhakti-Kadam"
    const userDoc = await User.findById(userId);
    const userName = userDoc ? userDoc.name : (req.user ? (req.user.name || req.user.email) : null);

    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt) : new Date();

    // Resolve user-wise screenshot path: /storage/screenshots/Bhakti-Kadam/07/28/12-00.png
    const pathInfo = getScreenshotPath(userId, userName, capturedAt, null, ext);

    // Save image buffer to local disk
    fs.writeFileSync(pathInfo.fullPath, req.file.buffer);
    console.log(`[Screenshot Controller] Successfully saved local file on disk: ${pathInfo.fullPath}`);

    // Upload image buffer directly to Cloudinary: folder = screenshots/Bhakti-Kadam/07/28, public_id = 12:00
    const cloudRes = await uploadToCloudinary(req.file.buffer, {
      folder: pathInfo.cloudinaryFolder,
      public_id: pathInfo.timeName
    });

    const cloudinaryUrl = cloudRes ? (cloudRes.secure_url || cloudRes.url) : null;
    const cloudinaryPublicId = cloudRes ? cloudRes.public_id : pathInfo.cloudinaryPublicId;

    if (cloudRes) {
      console.log(`[Screenshot Controller] Cloudinary upload success: ${cloudinaryUrl}`);
    }

    const fileSizeKB = Math.round(req.file.size / 1024);

    // Create DB Record with authoritative server time
    const screenshot = await Screenshot.create({
      userId,
      attendanceId,
      filePath: pathInfo.relativePath,
      cloudinaryUrl,
      cloudinaryPublicId,
      capturedAt,
      isFirstOfSession: isFirstOfSession === 'true' || isFirstOfSession === true,
      isOfflineSync: isOfflineSync === 'true' || isOfflineSync === true,
      fileSizeKB
    });

    console.log(`[Screenshot Controller] DB record created successfully: ID=${screenshot._id}`);

    return res.status(201).json({
      success: true,
      message: 'Screenshot uploaded successfully',
      screenshotId: screenshot._id,
      filePath: screenshot.filePath,
      cloudinaryUrl: screenshot.cloudinaryUrl
    });
  } catch (error) {
    console.error('[Screenshot Controller] Upload error:', error);
    return res.status(500).json({ success: false, message: 'Server error uploading screenshot.', error: error.message });
  }
};

/**
 * Handle offline retry screenshot sync
 */
const syncScreenshot = async (req, res) => {
  req.body.isOfflineSync = true;
  return uploadScreenshot(req, res);
};

/**
 * Get system screenshot configuration
 */
const getConfig = async (req, res) => {
  try {
    let config = await ScreenshotConfig.findOne();
    if (!config) {
      config = await ScreenshotConfig.create({
        intervalMinutes: 30,
        captureOnClockIn: true,
        imageFormat: 'jpeg',
        imageQuality: 75,
        isEnabled: true
      });
    }
    return res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('[Screenshot Controller] GetConfig error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching screenshot config.' });
  }
};

/**
 * Update system screenshot configuration (Super Admin Only)
 */
const updateConfig = async (req, res) => {
  try {
    const { intervalMinutes, captureOnClockIn, imageFormat, imageQuality, isEnabled } = req.body;

    let config = await ScreenshotConfig.findOne();
    if (!config) {
      config = new ScreenshotConfig();
    }

    if (intervalMinutes !== undefined) config.intervalMinutes = intervalMinutes;
    if (captureOnClockIn !== undefined) config.captureOnClockIn = captureOnClockIn;
    if (imageFormat !== undefined) config.imageFormat = imageFormat;
    if (imageQuality !== undefined) config.imageQuality = imageQuality;
    if (isEnabled !== undefined) config.isEnabled = isEnabled;
    config.updatedBy = req.user ? (req.user.userId || req.user.id || req.user._id) : undefined;

    await config.save();
    return res.status(200).json({ success: true, message: 'Screenshot configuration updated successfully.', config });
  } catch (error) {
    console.error('[Screenshot Controller] UpdateConfig error:', error);
    return res.status(500).json({ success: false, message: 'Error updating screenshot config.' });
  }
};

/**
 * Get Employee Screenshots (Super Admin ONLY)
 */
const getEmployeeScreenshots = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, attendanceId } = req.query;

    const query = { userId };

    if (attendanceId) {
      query.attendanceId = attendanceId;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.capturedAt = { $gte: startDate, $lte: endDate };
    }

    const screenshots = await Screenshot.find(query)
      .sort({ capturedAt: -1 })
      .populate('userId', 'name email role employeeId')
      .populate('attendanceId', 'clockIn clockOut status');

    return res.status(200).json({
      success: true,
      count: screenshots.length,
      screenshots
    });
  } catch (error) {
    console.error('[Screenshot Controller] GetEmployeeScreenshots error:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving employee screenshots.' });
  }
};

/**
 * Bulk Download Employee Screenshots as ZIP (Super Admin ONLY)
 */
const downloadEmployeeScreenshotsZip = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;

    const query = { userId };
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.capturedAt = { $gte: startDate, $lte: endDate };
    }

    const screenshots = await Screenshot.find(query).sort({ capturedAt: 1 });

    if (!screenshots || screenshots.length === 0) {
      return res.status(404).json({ success: false, message: 'No screenshots found for this employee/date.' });
    }

    const zipFilename = `screenshots_${userId}_${date || 'all'}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const ss of screenshots) {
      const safePath = safeResolvePath(ss.filePath);

      if (safePath && fs.existsSync(safePath)) {
        const entryName = path.basename(safePath);
        archive.file(safePath, { name: entryName });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('[Screenshot Controller] DownloadZip error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Error generating screenshots ZIP package.' });
    }
  }
};

module.exports = {
  upload,
  uploadScreenshot,
  syncScreenshot,
  getConfig,
  updateConfig,
  getEmployeeScreenshots,
  downloadEmployeeScreenshotsZip
};
