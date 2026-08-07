const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Get Active Departments (All Employees)
router.get('/active', departmentController.getActiveDepartments);

// Create Department (Admin & Super Admin)
router.post('/create', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), departmentController.createDepartment);

module.exports = router;
