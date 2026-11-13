import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { Ream } from 'reamkit';
import { standardFonts } from '@formepdf/fonts-standard';

function fontsForReam() {
  const sans = standardFonts().filter((font) => font.family === 'Liberation Sans');
  const pick = (weight, style) =>
    sans.find((font) => font.fontWeight === weight && font.fontStyle === style)?.src;

  return {
    regular: pick(400, 'normal'),
    bold: pick(700, 'normal'),
    italic: pick(400, 'italic'),
    boldItalic: pick(700, 'italic'),
  };
}

try {
  const source = fs.readFileSync(workerData.inputPath);
  const doc = Ream.parse(new Uint8Array(source));
  const pdf = await doc.convert('pdf', { fonts: fontsForReam() });
  fs.writeFileSync(workerData.outputPath, pdf);
  parentPort?.postMessage({ ok: true });
} catch (err) {
  parentPort?.postMessage({ ok: false, error: err?.message || String(err) });
}
