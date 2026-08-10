const express = require('express');
const router = express.Router({ mergeParams: true });
const documentFolderController = require('../controllers/documentFolder.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Document Folder Routes
router.post('/create', documentFolderController.createFolder);
router.get('/', documentFolderController.getProjectFolders);
router.put('/:id', documentFolderController.updateFolder);
router.delete('/:id', documentFolderController.deleteFolder);

module.exports = router;
