const fs = require('fs');
const path = require('path');
const { Worker } = require('node:worker_threads');

const WORKER_FILE = path.join(__dirname, 'presentationConverter.worker.mjs');
const DEFAULT_TIMEOUT_MS = 45000;

// Convertit une présentation en PDF dans un worker isolé (timeout + fallback possible).
function convertPresentationToPdf(inputPath, outputPath, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(WORKER_FILE, { workerData: { inputPath, outputPath } });

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (err) {
        fs.promises.unlink(outputPath).catch(() => {});
        reject(err);
      } else {
        resolve(outputPath);
      }
    };

    const timer = setTimeout(
      () => finish(new Error('Délai de conversion de la présentation dépassé')),
      timeoutMs
    );

    worker.once('message', (msg) => {
      if (msg && msg.ok) finish();
      else finish(new Error(msg?.error || 'Conversion de la présentation impossible'));
    });
    worker.once('error', (err) => finish(err));
    worker.once('exit', (code) => {
      if (!settled) finish(new Error(`Conversion interrompue (code ${code})`));
    });
  });
}

module.exports = { convertPresentationToPdf };
