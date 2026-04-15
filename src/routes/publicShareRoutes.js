const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/shareController');

router.get('/shares/:token', asyncHandler(controller.getPublicShare));
router.post('/shares/:token/validate-pin', asyncHandler(controller.validatePin));
router.get('/shares/:token/documents/:idHistorialDocumentoGuardado/view', asyncHandler(controller.viewDocument));
router.get('/shares/:token/documents/:idHistorialDocumentoGuardado/download', asyncHandler(controller.downloadDocument));
router.get('/shares/:token/download-zip', asyncHandler(controller.downloadZip));

module.exports = router;
