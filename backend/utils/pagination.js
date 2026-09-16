// Pagination simple ?limit=&offset= (bornes raisonnables).
function pageParams(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

module.exports = { pageParams };
