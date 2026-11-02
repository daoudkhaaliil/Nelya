const { Op, fn, col, where: whereFn } = require('sequelize');
const { features } = require('../config/dbFeatures');

// Plafond dur : même si le client demande ?limit=100000, il n'obtiendra jamais plus que cela.
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInteger(raw, fallback) {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseNumber(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// % et _ sont des jokers LIKE : sans échappement, chercher « 50% » remonte tout le
// catalogue et « _ » n'importe quel caractère. On les traite comme du texte saisi.
function escapeLikePattern(term) {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Traduit les paramètres d'URL en options Sequelize, en n'acceptant que les champs
 * explicitement déclarés dans la configuration du modèle. Un nom de colonne venant
 * du client n'atteint jamais la requête SQL sans figurer dans l'une de ces listes.
 *
 * @param {object} query - req.query
 * @param {object} config - entrée MODEL_CONFIG du modèle
 * @returns {{ where: object, order: Array, limit: number, offset: number, page: number, paginated: boolean }}
 */
function buildListQuery(query = {}, config = {}) {
  const paginated = query.page !== undefined || query.limit !== undefined;

  const page = Math.max(1, parseInteger(query.page, 1));
  const requestedLimit = parseInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));

  const where = {};

  // ?ids=a,b,c — sert aux écrans qui connaissent déjà les identifiants voulus
  // (la liste d'envies notamment) et n'ont aucune raison de lire tout le catalogue.
  if (query.ids !== undefined) {
    const ids = String(query.ids)
      .split(',')
      .map((id) => id.trim())
      // Les identifiants sont des UUID : une valeur malformée ferait échouer la
      // conversion côté PostgreSQL et remonterait en erreur 500.
      .filter((id) => UUID_PATTERN.test(id))
      .slice(0, MAX_LIMIT);
    // Un ids vide doit donner zéro résultat, pas le catalogue entier.
    where.id = { [Op.in]: ids };
  }

  const search = String(query.search || '').trim();
  if (search && config.searchFields?.length) {
    const pattern = `%${escapeLikePattern(search)}%`;
    where[Op.or] = config.searchFields.map((field) => {
      if (!features.unaccent) {
        return { [field]: { [Op.iLike]: pattern } };
      }
      // unaccent des deux côtés : « deodorant » retrouve « Déodorant ».
      // Le motif passe par fn(), donc échappé par Sequelize et non concaténé en SQL.
      return whereFn(fn('unaccent', col(field)), {
        [Op.iLike]: fn('unaccent', pattern)
      });
    });
  }

  for (const field of config.filterFields || []) {
    const value = query[field];
    if (value !== undefined && String(value).trim() !== '') {
      where[field] = String(value);
    }
  }

  // Bornes numériques : ?price_min=10&price_max=90
  for (const field of config.rangeFields || []) {
    const min = parseNumber(query[`${field}_min`]);
    const max = parseNumber(query[`${field}_max`]);
    if (min === null && max === null) continue;
    where[field] = {};
    if (min !== null) where[field][Op.gte] = min;
    if (max !== null) where[field][Op.lte] = max;
  }

  // Un ordre total et déterministe : sans second critère, deux lignes de même prix
  // peuvent changer de page d'une requête à l'autre et un produit devient invisible.
  // sortFields associe le nom public (?sort=price:asc) à l'attribut du modèle.
  const order = [];
  const [rawField, rawDirection] = String(query.sort || '').split(':');
  const direction = String(rawDirection).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const attribute = (config.sortFields || {})[rawField];
  if (attribute) {
    order.push([attribute, direction]);
  } else {
    order.push(['createdAt', 'DESC']);
  }
  order.push(['id', 'ASC']);

  return { where, order, limit, offset: (page - 1) * limit, page, paginated };
}

module.exports = { buildListQuery, escapeLikePattern, MAX_LIMIT, DEFAULT_LIMIT };
