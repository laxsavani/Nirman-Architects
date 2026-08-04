const express = require('express');
const router = express.Router();
const siteLocationController = require('../controllers/siteLocation.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * @swagger
 * /site-locations:
 *   post:
 *     summary: Configure Project Site Geo-Fence Location (PM / HR)
 *     description: Configures or updates GPS coordinates and allowed radius in meters for a project site.
 *     tags:
 *       - Site Locations
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectName
 *               - lat
 *               - lng
 *             properties:
 *               projectId:
 *                 type: string
 *               projectName:
 *                 type: string
 *                 example: "Nirman Commercial Tower"
 *               lat:
 *                 type: number
 *                 example: 23.0225
 *               lng:
 *                 type: number
 *                 example: 72.5714
 *               radiusMeters:
 *                 type: number
 *                 example: 100
 *     responses:
 *       201:
 *         description: Site location configured successfully.
 */
router.post('/', siteLocationController.createSiteLocation);

/**
 * @swagger
 * /site-locations:
 *   get:
 *     summary: Get all project site locations
 *     description: Retrieves all configured site locations and geo-fence radiuses.
 *     tags:
 *       - Site Locations
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', siteLocationController.getSiteLocations);

module.exports = router;
