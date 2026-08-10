const express = require('express');
const router = express.Router({ mergeParams: true });
const documentController = require('../controllers/document.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Document Upload & Versioning
router.post('/upload', documentController.uploadDocument);
router.post('/:id/versions/upload', documentController.uploadDocumentVersion);

// Project Documents List & Search
router.get('/search', documentController.searchDocuments);
router.get('/', documentController.getProjectDocuments);

// Document Details, Update, Soft-Delete
router.get('/:id', documentController.getDocumentById);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

// Visibility Control (CRM Module 6 Handoff)
router.put('/:id/visibility', documentController.toggleClientVisibility);

// Logged Preview & Download
router.get('/:id/preview', documentController.previewDocument);
router.get('/:id/download', documentController.downloadDocument);

// Internal Access Audit History Log
router.get('/:id/access-log', documentController.getDocumentAccessLog);

module.exports = router;
