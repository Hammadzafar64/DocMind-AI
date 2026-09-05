const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/ai/status', settingsController.getAIStatus);
router.get('/settings', settingsController.getSettings);
router.post('/settings', settingsController.updateSettings);

module.exports = router;
