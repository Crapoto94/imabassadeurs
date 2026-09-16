const { db, SCHEMA } = require('../pg_db');
const apm = require('./apm');

// Remplace les variables {{nom}} d'un gabarit par leurs valeurs.
function remplirGabarit(template, variables = {}) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

async function getPromptConfig(actionKey) {
  return db.get(
    `SELECT action_key, label, prompt_template, preferred_model
       FROM ${SCHEMA}.ai_prompts WHERE action_key = $1`,
    [actionKey]
  );
}

async function construirePrompt(actionKey, variables) {
  const cfg = await getPromptConfig(actionKey);
  if (!cfg) throw new Error(`Action IA inconnue : ${actionKey}`);
  return remplirGabarit(cfg.prompt_template, variables);
}

// Fonction unique d'exécution d'une action IA applicative (cf. §7.1 du cahier des charges).
async function executerActionIA(actionKey, variables) {
  const cfg = await getPromptConfig(actionKey);
  if (!cfg) throw new Error(`Action IA inconnue : ${actionKey}`);
  const prompt = remplirGabarit(cfg.prompt_template, variables);
  const result = await apm.interrogerIA(prompt, cfg.preferred_model || undefined);
  return { ...result, action_key: actionKey };
}

module.exports = { executerActionIA, construirePrompt, getPromptConfig, remplirGabarit };
