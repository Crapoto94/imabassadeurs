const express = require('express');
const path = require('path');
const multer = require('multer');
const service = require('./experiments.service');
const { requireAuth, requireInteract } = require('../../middleware/auth');
const { asyncHandler, ApiError } = require('../../utils/errors');

const router = express.Router();

// Pièces jointes : documents texte, présentations et tableurs (PDF inclus), 10 Mo max.
const DOC_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/csv',
]);
const DOC_EXT = /\.(pdf|docx?|odt|pptx?|odp|xlsx?|ods|rtf|txt|csv)$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]+/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (DOC_MIME_TYPES.has(file.mimetype) || DOC_EXT.test(file.originalname)) cb(null, true);
    else cb(new Error('Format non accepté : joignez un PDF, un document texte, une présentation ou un tableur'));
  },
});

router.get('/', requireAuth, asyncHandler(async (req, res) => res.json(await service.list(req.user, req.query))));
router.get('/:id', requireAuth, asyncHandler(async (req, res) => res.json(await service.getById(parseInt(req.params.id, 10), req.user))));
router.post('/', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.status(201).json({ id: await service.create(req.user, req.body) });
}));
router.put('/:id', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.update(req.user, parseInt(req.params.id, 10), req.body));
}));
router.delete('/:id', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.remove(req.user, parseInt(req.params.id, 10)));
}));
router.patch('/:id/status', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.updateStatus(req.user, parseInt(req.params.id, 10), req.body.status));
}));
router.post('/:id/join', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.toggleJoin(req.user, parseInt(req.params.id, 10)));
}));
router.post('/:id/attachments', requireAuth, requireInteract, upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.addAttachment(req.user, parseInt(req.params.id, 10), req.file));
}));
router.delete('/:id/attachments/:attachmentId', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  res.json(await service.removeAttachment(req.user, parseInt(req.params.id, 10), parseInt(req.params.attachmentId, 10)));
}));
router.post('/:id/synthesize', requireAuth, requireInteract, asyncHandler(async (req, res) => {
  try {
    res.json(await service.synthesize(req.user, parseInt(req.params.id, 10)));
  } catch (err) {
    throw new ApiError(502, "Échec de la synthèse IA : " + err.message);
  }
}));

module.exports = router;
