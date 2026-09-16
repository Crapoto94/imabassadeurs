const express = require('express');
const path = require('path');
const multer = require('multer');
const ctrl = require('./resources.controller');
const { requireAuth, requireInteract, requireIanimateur } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo (cohérence Ville)
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les PDF sont acceptés'));
  },
});

router.get('/', requireAuth, asyncHandler(ctrl.list));
router.get('/:id', requireAuth, asyncHandler(ctrl.getOne));
router.post('/', requireAuth, requireInteract, upload.single('file'), asyncHandler(ctrl.create));
router.put('/:id', requireAuth, requireInteract, asyncHandler(ctrl.update));
router.delete('/:id', requireAuth, requireInteract, asyncHandler(ctrl.remove));
router.post('/:id/review', requireAuth, requireIanimateur, asyncHandler(ctrl.review));
router.post('/:id/rate', requireAuth, requireInteract, asyncHandler(ctrl.rate));
router.post('/:id/synthesize', requireAuth, requireInteract, asyncHandler(ctrl.synthDoc));
router.post('/:id/synthesize-thread', requireAuth, requireInteract, asyncHandler(ctrl.synthThread));

module.exports = router;
