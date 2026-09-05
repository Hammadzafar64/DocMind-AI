const express = require('express');
const router = express.Router();
const docController = require('../controllers/docController');
const upload = require('../middlewares/uploadMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/upload', authenticateToken, upload.single('file'), docController.uploadDocument);
router.get('/documents', authenticateToken, docController.listDocuments);
router.get('/documents/:id', authenticateToken, docController.getDocument);
router.get('/documents/:id/text', authenticateToken, docController.getDocumentText);
router.delete('/documents/:id', authenticateToken, docController.deleteDocument);

module.exports = router;
