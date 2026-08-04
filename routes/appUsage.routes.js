const express = require('express');
const router = express.Router();
const appUsageController = require('../controllers/appUsage.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const blockSuperAdminTracking = require('../middlewares/blockSuperAdminTracking.middleware');

/**
 * @swagger
 * /app-usage/sync:
 *   post:
 *     summary: Sync workstation app usage 5-minute batch (Desktop Agent)
 *     description: Flushes desktop application usage tracking metrics from agent to server.
 *     tags:
 *       - App Usage Tracking
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attendanceId
 *               - appUsage
 *             properties:
 *               userId:
 *                 type: string
 *               attendanceId:
 *                 type: string
 *               appUsage:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     appName:
 *                       type: string
 *                     secondsActive:
 *                       type: number
 *                     windowTitle:
 *                       type: string
 *               isOfflineSync:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: App usage batch synced successfully
 */
router.post('/sync', authMiddleware, blockSuperAdminTracking, appUsageController.syncAppUsage);

/**
 * @swagger
 * /app-usage/config:
 *   get:
 *     summary: Get application tracking configuration settings
 *     tags:
 *       - App Usage Tracking
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration object retrieved
 *   put:
 *     summary: Update application tracking configuration settings (Super Admin Only)
 *     tags:
 *       - App Usage Tracking
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.get('/config', authMiddleware, appUsageController.getConfig);
router.put('/config', authMiddleware, roleMiddleware(['SUPER_ADMIN']), appUsageController.updateConfig);

/**
 * @swagger
 * /app-usage/employee/{userId}:
 *   get:
 *     summary: Get employee app usage breakdown (Super Admin Only)
 *     tags:
 *       - App Usage Tracking
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee app usage breakdown retrieved
 */
router.get('/employee/:userId', authMiddleware, roleMiddleware(['SUPER_ADMIN']), appUsageController.getEmployeeAppUsage);

/**
 * @swagger
 * /app-usage/employee/{userId}/export:
 *   get:
 *     summary: Export employee app usage data (Super Admin Only)
 *     tags:
 *       - App Usage Tracking
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *     responses:
 *       200:
 *         description: Export data or CSV stream
 */
router.get('/employee/:userId/export', authMiddleware, roleMiddleware(['SUPER_ADMIN']), appUsageController.exportEmployeeAppUsage);

module.exports = router;

