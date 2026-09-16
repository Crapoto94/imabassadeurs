const { db, SCHEMA } = require('../../pg_db');
const ia = require('../../services/ia');
const votes = require('../votes/votes.service');
const { logAction } = require('../../utils/audit');

// Extrait un objet JSON d'une réponse IA (tolère les fences ```json).
function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = Math.min(...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0), Infinity);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start === Infinity || end < 0) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// ───────────────────────────── Principes de Charte ─────────────────────────
async function listPrinciples(user) {
  return db.all(
    `SELECT p.*, u.display_name AS created_by_name,
            (SELECT count(*)::int FROM ${SCHEMA}.idea_links l WHERE l.target_type='principle' AND l.target_id=p.id) AS links_count
       FROM ${SCHEMA}.charter_principles p JOIN ${SCHEMA}.users u ON u.id = p.created_by
      ORDER BY p.status DESC, p.created_at DESC`
  );
}

async function createPrinciple(user, data) {
  const { title, body } = data;
  if (!title || !body) throw Object.assign(new Error('Titre et contenu requis'), { status: 400 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.charter_principles (title, body, created_by) VALUES ($1,$2,$3) RETURNING id`,
    [title, body, user.id]
  );
  await logAction(user.id, 'principle_create', 'principle', row.id, null);
  return { id: row.id };
}

async function setPrincipleStatus(user, id, status) {
  if (!(user.roles.includes('ianimateur') || user.roles.includes('admin'))) {
    throw Object.assign(new Error('Réservé aux IAnimateurs'), { status: 403 });
  }
  if (!['draft', 'adopted'].includes(status)) throw Object.assign(new Error('Statut invalide'), { status: 400 });
  await db.run(`UPDATE ${SCHEMA}.charter_principles SET status=$2 WHERE id=$1`, [id, status]);
  await logAction(user.id, 'principle_status', 'principle', id, { status });
  return { id, status };
}

// ───────────────────────────── Liens (idea_links) ──────────────────────────
async function createLink(user, data) {
  const { source_type, source_id, target_type, target_id } = data;
  const types = ['comment', 'resource', 'risk', 'experiment'];
  const targets = ['principle', 'risk', 'experiment', 'resource'];
  if (!types.includes(source_type) || !targets.includes(target_type)) throw Object.assign(new Error('Type invalide'), { status: 400 });
  const row = await db.get(
    `INSERT INTO ${SCHEMA}.idea_links (source_type, source_id, target_type, target_id, created_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (source_type, source_id, target_type, target_id) DO NOTHING
     RETURNING id`,
    [source_type, source_id, target_type, target_id, user.id]
  );
  return { id: row?.id || null };
}

async function deleteLink(user, id) {
  await db.run(`DELETE FROM ${SCHEMA}.idea_links WHERE id=$1`, [id]);
  return { id, deleted: true };
}

// ─────────────────────────────── Graphe ────────────────────────────────────
async function graph() {
  const [resources, comments, risks, experiments, principles, links, clusters, clusterItems] = await Promise.all([
    db.all(`SELECT r.id, r.title AS label, r.status, r.created_at, u.display_name AS author_name, u.direction, u.service
              FROM ${SCHEMA}.resources r JOIN ${SCHEMA}.users u ON u.id=r.proposed_by`),
    db.all(`SELECT c.id, left(c.body, 80) AS label, c.entity_type, c.entity_id, c.created_at, u.display_name AS author_name, u.direction, u.service
              FROM ${SCHEMA}.comments c JOIN ${SCHEMA}.users u ON u.id=c.author_id`),
    db.all(`SELECT r.id, r.title AS label, r.importance, r.probability, r.created_at, u.display_name AS author_name, u.direction, u.service
              FROM ${SCHEMA}.risks r JOIN ${SCHEMA}.users u ON u.id=r.proposed_by`),
    db.all(`SELECT e.id, e.title AS label, e.status, e.created_at, u.display_name AS author_name, u.direction, u.service
              FROM ${SCHEMA}.experiments e JOIN ${SCHEMA}.users u ON u.id=e.created_by`),
    db.all(`SELECT p.id, p.title AS label, p.status, p.created_at, u.display_name AS author_name FROM ${SCHEMA}.charter_principles p JOIN ${SCHEMA}.users u ON u.id=p.created_by`),
    db.all(`SELECT id, source_type, source_id, target_type, target_id FROM ${SCHEMA}.idea_links`),
    db.all(`SELECT id, label, description FROM ${SCHEMA}.idea_clusters`),
    db.all(`SELECT cluster_id, entity_type, entity_id FROM ${SCHEMA}.idea_cluster_items`),
  ]);

  const nodes = [];
  const edges = [];
  const add = (type, rows, extra = () => ({})) => rows.forEach((r) => nodes.push({ id: `${type}:${r.id}`, type, ...r, ...extra(r) }));

  add('resource', resources);
  add('risk', risks);
  add('experiment', experiments);
  add('principle', principles);
  add('comment', comments);

  // Rattachement des commentaires à leur entité support.
  comments.forEach((c) => edges.push({ source: `comment:${c.id}`, target: `${c.entity_type}:${c.entity_id}`, kind: 'comment' }));
  // Liens idées ↔ éléments structurants.
  links.forEach((l) => edges.push({ source: `${l.source_type}:${l.source_id}`, target: `${l.target_type}:${l.target_id}`, kind: 'link', id: l.id }));
  // Clusters.
  add('cluster', clusters);
  clusterItems.forEach((ci) => edges.push({ source: `cluster:${ci.cluster_id}`, target: `${ci.entity_type}:${ci.entity_id}`, kind: 'cluster' }));

  return { nodes, edges, clusters };
}

// ─────────────────────── Clustering IA (Cartographie) ──────────────────────
async function contenusPourIA() {
  const rows = await db.all(`
    SELECT 'resource' AS type, id, title || ' — ' || description AS contenu FROM ${SCHEMA}.resources WHERE status='published'
    UNION ALL SELECT 'risk', id, title || ' — ' || description FROM ${SCHEMA}.risks
    UNION ALL SELECT 'experiment', id, title || ' — ' || objective FROM ${SCHEMA}.experiments
    UNION ALL SELECT 'comment', id, body FROM ${SCHEMA}.comments
    LIMIT 200`);
  return rows;
}

async function generateClusters(user) {
  const contenus = await contenusPourIA();
  const payload = contenus.map((c) => `[${c.type}:${c.id}] ${c.contenu}`).join('\n');
  const res = await ia.executerActionIA('thematic_clustering', { contenus: payload });
  const parsed = extractJson(res.response);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw Object.assign(new Error('Réponse IA non exploitable'), { status: 502 });
  }
  await db.run(`TRUNCATE ${SCHEMA}.idea_clusters RESTART IDENTITY CASCADE`);
  for (const cl of parsed) {
    if (!cl.label) continue;
    const c = await db.get(
      `INSERT INTO ${SCHEMA}.idea_clusters (label, description, generated_by_ai) VALUES ($1,$2,true) RETURNING id`,
      [cl.label, cl.description || null]
    );
    for (const item of cl.items || []) {
      if (!item?.type || !item?.id) continue;
      await db.run(
        `INSERT INTO ${SCHEMA}.idea_cluster_items (cluster_id, entity_type, entity_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [c.id, item.type, item.id]
      );
    }
  }
  await logAction(user?.id, 'clusters_generate', 'cluster', null, { count: parsed.length });
  return graph();
}

// ─────────────────── Consensus / controverses (IA) ─────────────────────────
async function analyseConsensus(user) {
  const contenus = await contenusPourIA();
  const payload = contenus.map((c) => `[${c.type}:${c.id}] ${c.contenu}`).join('\n');
  const voteText = await votes.votesText();
  const res = await ia.executerActionIA('consensus_analysis', { contenus: payload, votes: voteText || '(aucun vote)' });
  return { raw: res.response, parsed: extractJson(res.response), model: res.model_name, provider: res.provider_label };
}

// ───────────────────────────── Indicateurs ─────────────────────────────────
async function stats() {
  const counts = await db.get(`
    SELECT
      (SELECT count(*)::int FROM ${SCHEMA}.resources WHERE status='published') AS resources,
      (SELECT count(*)::int FROM ${SCHEMA}.comments) AS comments,
      (SELECT count(*)::int FROM ${SCHEMA}.risks) AS risks,
      (SELECT count(*)::int FROM ${SCHEMA}.experiments) AS experiments,
      (SELECT count(*)::int FROM ${SCHEMA}.experiments WHERE status='abandoned') AS experiments_abandoned,
      (SELECT count(*)::int FROM ${SCHEMA}.resources WHERE status='rejected') AS resources_rejected,
      (SELECT count(*)::int FROM ${SCHEMA}.charter_principles WHERE status='adopted') AS principles_adopted
  `);
  const retained = await db.get(`
    SELECT count(DISTINCT (l.source_type || ':' || l.source_id))::int AS n
      FROM ${SCHEMA}.idea_links l
      JOIN ${SCHEMA}.charter_principles p ON p.id = l.target_id AND l.target_type='principle' AND p.status='adopted'
  `);
  const sessions = await db.all(`
    SELECT s.id,
      (SELECT count(*)::int FROM ${SCHEMA}.vote_responses v WHERE v.session_id=s.id) AS total,
      (SELECT max(c)::int FROM (SELECT count(*)::int AS c FROM ${SCHEMA}.vote_responses v WHERE v.session_id=s.id GROUP BY v.option_id) t) AS top
      FROM ${SCHEMA}.vote_sessions s`);
  const rates = sessions.filter((s) => s.total > 0).map((s) => (s.top || 0) / s.total);
  const consensus = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const themes = await db.all(`
    SELECT c.label, (SELECT count(*)::int FROM ${SCHEMA}.idea_cluster_items i WHERE i.cluster_id=c.id) AS items
      FROM ${SCHEMA}.idea_clusters c ORDER BY items DESC LIMIT 8`);

  const totalIdeas = counts.resources + counts.comments + counts.risks + counts.experiments;
  return {
    ...counts,
    ideas_total: totalIdeas,
    ideas_retained: retained.n,
    consensus_rate: Math.round(consensus * 100),
    active_themes: themes,
  };
}

module.exports = {
  listPrinciples, createPrinciple, setPrincipleStatus,
  createLink, deleteLink,
  graph, generateClusters, analyseConsensus, stats, extractJson,
};
