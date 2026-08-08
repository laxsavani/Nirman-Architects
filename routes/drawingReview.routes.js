const express = require('express');
const router = express.Router();
const drawingReviewController = require('../controllers/drawingReview.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Aggregated Review Data Payload for Viewer Component
router.get('/:versionId/review-data', drawingReviewController.getAggregatedReviewData);

// Pinned Notes & General Comments
router.post('/:versionId/comments', drawingReviewController.postCommentOrNote);
router.get('/:versionId/comments', drawingReviewController.getVersionComments);

// Freehand & Shape Markings
router.post('/:versionId/markings', drawingReviewController.postMarking);
router.get('/:versionId/markings', drawingReviewController.getVersionMarkings);
router.delete('/:versionId/markings/:markingId', drawingReviewController.deleteMarking);

module.exports = router;
