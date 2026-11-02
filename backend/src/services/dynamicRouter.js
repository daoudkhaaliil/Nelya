const express = require('express');
const BaseService = require('./BaseService');
const models = require('../models');
const { auth, optionalAuth, authorize, requirePermission } = require('../middlewares/auth');
const { buildListQuery } = require('./listQuery');
const audit = require('./auditService');
const { normalizeProductImages } = require('../utils/productImages');

const ENTITY_BY_MODEL = { Product: 'product', Category: 'category', User: 'user' };

function sendWriteError(res, next, error) {
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ error: 'Cette valeur existe déjà.' });
  }
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: error.errors?.[0]?.message || 'Données invalides.' });
  }
  return next(error);
}

function recordLabel(modelName, row) {
  if (!row) return '';
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  if (modelName === 'Product') return json.name || json.reference || json.id;
  if (modelName === 'Category') return json.name || json.id;
  if (modelName === 'User') return `${json.first_name || ''} ${json.last_name || ''}`.trim() || json.email || json.id;
  return json.id;
}

// [SEC-FIX] Configuration par modèle : contrôle fin de ce qui est lisible/écrivable.
// searchFields / filterFields / rangeFields / sortFields font aussi office de liste
// blanche pour la pagination : aucun autre nom de colonne n'est accepté de l'URL.
const MODEL_CONFIG = {
  Product: {
    publicRead: true,
    alwaysPaginate: true,
    writePermission: 'products.manage',
    writeFields: ['reference', 'name', 'contenance', 'description', 'price', 'cost_price', 'stock', 'image_url', 'images', 'category', 'subcategory'],
    searchFields: ['name', 'description', 'reference', 'category', 'subcategory'],
    filterFields: ['category', 'subcategory'],
    rangeFields: ['price', 'stock'],
    sortFields: { name: 'name', price: 'price', stock: 'stock', newest: 'createdAt' },
  },
  Category: {
    publicRead: true,
    writePermission: 'categories.manage',
    writeFields: ['name', 'description', 'parent_id'],
    searchFields: ['name'],
    sortFields: { name: 'name', newest: 'createdAt' },
  },
  User: {
    publicRead: false,
    readRoles: ['admin'],
    writeFields: ['first_name', 'last_name', 'email', 'password', 'role', 'permission_group_id'],
    readExclude: ['password'],
    searchFields: ['first_name', 'last_name', 'email'],
    filterFields: ['role'],
    sortFields: { email: 'email', newest: 'createdAt' },
  },
};

function pickFields(body, fields) {
  const out = {};
  if (!fields) return body;
  for (const field of fields) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

function sanitize(modelName, data, req) {
  const config = MODEL_CONFIG[modelName] || {};
  const hideCost = modelName === 'Product' && !(req?.user && (req.user.role === 'admin' || req.user.role === 'seller'));
  const exclude = [...(config.readExclude || [])];
  if (hideCost) exclude.push('cost_price');
  if (!exclude.length || data === null || data === undefined) return data;
  const clean = (item) => {
    const json = item && typeof item.toJSON === 'function' ? item.toJSON() : item;
    for (const field of exclude) delete json[field];
    if (modelName === 'Product') {
      const gallery = normalizeProductImages(json);
      json.images = gallery.images;
      json.image_url = gallery.image_url;
    }
    return json;
  };
  return Array.isArray(data) ? data.map(clean) : clean(data);
}

/**
 * Crée un routeur Express dynamique pour un modèle Sequelize donné.
 * @param {string} modelName - Le nom du modèle (ex: 'Product', 'Order', 'User')
 * @returns {Router} - Un routeur Express configuré avec les opérations CRUD de base.
 */
function createDynamicRouter(modelName) {
  const router = express.Router();
  const service = new BaseService(models[modelName]);
  const config = MODEL_CONFIG[modelName] || {};

  // [BUG-003 FIX] Routes publiques uniquement pour les produits, sécurisées pour le reste
  const checkReadAuth = (req, res, next) => {
    if (config.publicRead) return optionalAuth(req, res, next);
    return auth(req, res, () => {
      const roles = config.readRoles || ['admin', 'seller'];
      authorize(...roles)(req, res, next);
    });
  };

  const isStaff = (req) => req.user && (req.user.role === 'admin' || req.user.role === 'seller');

  const getReadOptions = (req) => {
    const exclude = [...(config.readExclude || [])];
    if (modelName === 'Product' && !isStaff(req)) exclude.push('cost_price');
    return exclude.length ? { attributes: { exclude } } : {};
  };

  // [SEC-FIX] Corps limité aux champs autorisés + rôle protégé (admin uniquement)
  const getWriteBody = (req, res) => {
    const data = pickFields(req.body, config.writeFields);
    if (modelName === 'User' && ('role' in data || 'permission_group_id' in data) && req.user.role !== 'admin') {
      res.status(403).json({ message: 'Seul un administrateur peut modifier le rôle ou le groupe' });
      return null;
    }
    if (modelName === 'User' && data.role === 'admin') {
      data.permission_group_id = 'admin';
    } else if (modelName === 'User' && data.role === 'client') {
      data.permission_group_id = null;
    } else if (modelName === 'User' && data.role === 'seller' && !data.permission_group_id) {
      data.permission_group_id = 'seller';
    }
    if (modelName === 'User' && 'password' in data && req.user.role !== 'admin') {
      res.status(403).json({ message: 'Seul un administrateur peut modifier le mot de passe' });
      return null;
    }
    if (modelName === 'Product' && 'cost_price' in data) {
      const cost = Number(data.cost_price);
      data.cost_price = Number.isFinite(cost) && cost >= 0 ? cost : 0;
    }
    if (modelName === 'Product' && ('images' in data || 'image_url' in data)) {
      const gallery = normalizeProductImages(data);
      data.images = gallery.images;
      data.image_url = gallery.image_url;
    }
    if (modelName === 'Product' && 'subcategory' in data) {
      const sub = String(data.subcategory || '').trim();
      data.subcategory = sub || null;
    }
    if (modelName === 'Category' && 'parent_id' in data) {
      data.parent_id = data.parent_id || null;
    }
    return data;
  };

  // Liste paginée dès que ?page ou ?limit est fourni : la réponse devient alors une
  // enveloppe { data, total, ... }. Sans ces paramètres on renvoie un tableau simple,
  // par compatibilité avec les écrans qui chargent une collection courte (catégories).
  router.get('/', checkReadAuth, async (req, res, next) => {
    try {
      const query = buildListQuery(req.query, config);
      const { where, order, limit, offset, page } = query;
      const paginated = config.alwaysPaginate || query.paginated;

      if (!paginated) {
        const data = await service.getAll({ ...getReadOptions(req), where, order });
        return res.json(sanitize(modelName, data, req));
      }

      const { rows, count } = await service.getPage({ ...getReadOptions(req), where, order, limit, offset });
      return res.json({
        data: sanitize(modelName, rows, req),
        total: count,
        page,
        limit,
        pages: Math.max(1, Math.ceil(count / limit))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', checkReadAuth, async (req, res, next) => {
    try {
      const data = await service.getById(req.params.id, getReadOptions(req));
      if (!data) return res.status(404).json({ message: 'Not found' });
      res.json(sanitize(modelName, data, req));
    } catch (error) {
      next(error);
    }
  });

  const checkWritePermission = (req, res, next) => {
    if (!config.writePermission) return next();
    return requirePermission(config.writePermission)(req, res, next);
  };

  // [BUG-003 FIX] Création : authentifié + rôle admin ou seller
  router.post('/', auth, authorize('admin', 'seller'), checkWritePermission, async (req, res, next) => {
    try {
      const data = getWriteBody(req, res);
      if (data === null) return;
      const created = await service.create(data);
      const entity = ENTITY_BY_MODEL[modelName];
      if (entity) {
        audit.log({
          req,
          action: `${entity}.create`,
          entity,
          entityId: created.id,
          summary: `a créé ${entity === 'user' ? 'le compte' : entity === 'category' ? 'la catégorie' : 'le produit'} « ${recordLabel(modelName, created)} »`
        });
      }
      res.status(201).json(sanitize(modelName, created, req));
    } catch (error) {
      sendWriteError(res, next, error);
    }
  });

  // [BUG-003 FIX] Modification : authentifié + rôle admin ou seller
  router.put('/:id', auth, authorize('admin', 'seller'), checkWritePermission, async (req, res, next) => {
    try {
      const data = getWriteBody(req, res);
      if (data === null) return;
      const updated = await service.update(req.params.id, data);
      if (!updated) return res.status(404).json({ message: 'Not found' });
      const fresh = await service.getById(req.params.id, getReadOptions(req));
      const entity = ENTITY_BY_MODEL[modelName];
      if (entity) {
        const passwordOnly = entity === 'user' && Object.keys(data).length === 1 && 'password' in data;
        audit.log({
          req,
          action: passwordOnly ? 'user.password' : `${entity}.update`,
          entity,
          entityId: req.params.id,
          summary: passwordOnly
            ? `a réinitialisé le mot de passe de « ${recordLabel(modelName, fresh)} »`
            : `a modifié ${entity === 'user' ? 'le compte' : entity === 'category' ? 'la catégorie' : 'le produit'} « ${recordLabel(modelName, fresh)} »`
        });
      }
      res.json(sanitize(modelName, fresh, req));
    } catch (error) {
      sendWriteError(res, next, error);
    }
  });

  // [BUG-003 FIX] Suppression : authentifié + rôle admin uniquement
  router.delete('/:id', auth, authorize('admin'), async (req, res, next) => {
    try {
      const existing = await service.getById(req.params.id);
      const deleted = await service.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Not found' });
      const entity = ENTITY_BY_MODEL[modelName];
      if (entity) {
        audit.log({
          req,
          action: `${entity}.delete`,
          entity,
          entityId: req.params.id,
          summary: `a supprimé ${entity === 'user' ? 'le compte' : entity === 'category' ? 'la catégorie' : 'le produit'} « ${recordLabel(modelName, existing)} »`
        });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createDynamicRouter;
