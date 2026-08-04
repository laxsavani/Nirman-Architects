const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.get('/roles', userController.getAllRoles);

router.get('/users', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.getAllUsers);
router.post('/users/create', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.createUser);
router.get('/users/:id', authMiddleware, userController.getUserById);
router.put('/users/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.updateUser);
router.delete('/users/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.deleteUser);
router.delete('/user/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.deleteUser);

// Admin Change Password Endpoints
router.put('/users/:id/change-password', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.changeUserPassword);
router.patch('/users/:id/change-password', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.changeUserPassword);
router.post('/users/:id/change-password', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.changeUserPassword);
router.put('/users/change-password/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'HR']), userController.changeUserPassword);

module.exports = router;
