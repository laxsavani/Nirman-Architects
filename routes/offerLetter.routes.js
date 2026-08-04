const express = require('express');
const router = express.Router();
const offerLetterController = require('../controllers/offerLetter.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Get metadata (employee views self, admin views any)
router.get('/:userId', offerLetterController.getOfferLetterMetadata);

// Download PDF (employee downloads self, admin downloads any)
router.get('/:userId/download', offerLetterController.downloadOfferLetterPDF);

// Admin/HR only: regenerate new offer letter version
router.post('/:userId/regenerate', roleMiddleware(['SUPER_ADMIN', 'HR']), offerLetterController.regenerateOfferLetter);

module.exports = router;
