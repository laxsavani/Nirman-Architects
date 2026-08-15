const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Get Departments (All Employees)
router.get('/', departmentController.getDepartments);
router.get('/active', departmentController.getActiveDepartments);

// Create, Update & Delete Department (Admin & Super Admin)
router.post('/create', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), departmentController.createDepartment);
router.put('/:id', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), departmentController.updateDepartment);
router.delete('/:id', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), departmentController.deleteDepartment);

module.exports = router;
