const express = require('express');
const path = require('path');
const multer = require('multer');
const ctrl = require('./resources.controller');
const { requireAuth, requireInteract, requireIanimateur, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/errors');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
// Fichiers acceptés : PDF (5 Mo) et présentations PowerPoint/ODP (20 Mo).
const RESOURCE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
]);
const RESOURCE_EXT = /\.(pdf|pptx?|odp)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // limite haute ; le service applique 5 Mo aux PDF
  fileFilter: (req, file, cb) => {
    if (RESOURCE_MIME_TYPES.has(file.mimetype) || RESOURCE_EXT.test(file.originalname)) cb(null, true);
    else cb(new Error('Formats acceptés : PDF, PowerPoint (.ppt/.pptx) ou présentation ODP'));
  },
});

router.get('/', requireAuth, asyncHandler(ctrl.list));
router.get('/:id', requireAuth, asyncHandler(ctrl.getOne));
router.post('/', requireAuth, requireInteract, upload.single('file'), asyncHandler(ctrl.create));
router.put('/:id', requireAuth, requireInteract, asyncHandler(ctrl.update));
router.delete('/:id', requireAuth, requireInteract, asyncHandler(ctrl.remove));
router.post('/:id/review', requireAuth, requireIanimateur, asyncHandler(ctrl.review));
router.patch('/:id/mandatory', requireAuth, requireAdmin, asyncHandler(ctrl.setMandatory));
router.post('/:id/rate', requireAuth, requireInteract, asyncHandler(ctrl.rate));
router.put('/:id/progress', requireAuth, asyncHandler(ctrl.setProgress));
router.post('/:id/complete', requireAuth, asyncHandler(ctrl.complete));
router.post('/:id/synthesize', requireAuth, requireInteract, asyncHandler(ctrl.synthDoc));
router.post('/:id/synthesize-thread', requireAuth, requireInteract, asyncHandler(ctrl.synthThread));

module.exports = router;
