const express = require('express');
const router = express.Router();
const roleMasterController = require('../controllers/roleMaster.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Public or Authenticated route to get all roles
router.get('/all', roleMasterController.getAllRoles);

// SuperAdmin only route to create new dynamic roles
router.post('/create', authMiddleware, roleMiddleware(['SUPER_ADMIN']), roleMasterController.createRole);

module.exports = router;
