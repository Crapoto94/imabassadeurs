const service = require('./resources.service');
const { ApiError } = require('../../utils/errors');

const list = async (req, res) => res.json(await service.list(req.user, req.query));
const getOne = async (req, res) => res.json(await service.getById(parseInt(req.params.id, 10), req.user));
const create = async (req, res) => {
  const id = await service.create(req.user, req.body, req.file);
  res.status(201).json({ id });
};
const review = async (req, res) => res.json(await service.review(req.user, parseInt(req.params.id, 10), req.body.status, req.body.note));
const rate = async (req, res) => res.json(await service.rate(req.user, parseInt(req.params.id, 10), req.body.stars));
const synthDoc = async (req, res) => {
  try {
    res.json(await service.synthesizeDocument(req.user, parseInt(req.params.id, 10)));
  } catch (err) {
    throw new ApiError(err.response?.status === 503 ? 503 : 502, err.response?.data?.error || "Échec de la synthèse IA : " + err.message);
  }
};
const synthThread = async (req, res) => {
  try {
    res.json(await service.synthesizeThread(req.user, parseInt(req.params.id, 10)));
  } catch (err) {
    throw new ApiError(err.response?.status === 503 ? 503 : 502, err.response?.data?.error || "Échec de la synthèse IA : " + err.message);
  }
};

module.exports = { list, getOne, create, review, rate, synthDoc, synthThread };
