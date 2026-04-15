const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/shareController');

router.post('/shares', asyncHandler(controller.createShare));
router.get('/shares', asyncHandler(controller.listShares));
router.get('/shares/:id', asyncHandler(controller.getShareDetail));
router.post('/shares/:id/revoke', asyncHandler(controller.revokeShare));

module.exports = router;
