const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op, fn, col } = require('sequelize');
const { auth, optionalAuth, authorize, requirePermission } = require('../middlewares/auth');
const { Review, User, Product } = require('../models');
const audit = require('../services/auditService');

const router = express.Router();

const REVIEW_USER = ['id', 'first_name', 'last_name'];
const STATUSES = ['approved', 'rejected'];

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { message: 'Trop d’avis envoyés. Réessayez plus tard.' }
});

function displayName(user) {
  const first = String(user?.first_name || 'Client').trim() || 'Client';
  const last = String(user?.last_name || '').trim();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

function toPublic(review) {
  const json = typeof review.toJSON === 'function' ? review.toJSON() : { ...review };
  return {
    id: json.id,
    product_id: json.product_id,
    product_name: json.Product?.name || null,
    product_image: json.Product?.image_url || null,
    rating: json.rating,
    comment: json.comment,
    featured: Boolean(json.featured),
    createdAt: json.createdAt,
    author: displayName(json.User),
    authorInitial: String(json.User?.first_name || 'C').trim().charAt(0).toUpperCase()
  };
}

function toAdmin(review) {
  const json = typeof review.toJSON === 'function' ? review.toJSON() : { ...review };
  return {
    ...toPublic(review),
    status: json.status,
    user_id: json.user_id,
    email: json.User?.email || null,
    author_full: [json.User?.first_name, json.User?.last_name].filter(Boolean).join(' ')
  };
}

function parseComment(raw) {
  const comment = String(raw || '').trim().replace(/\s+/g, ' ');
  if (comment.length < 10) return { error: 'L’avis doit faire au moins 10 caractères.' };
  if (comment.length > 800) return { error: 'L’avis est trop long (800 caractères max).' };
  return { comment };
}

function parseRating(raw) {
  const rating = Number(raw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'La note doit être entre 1 et 5.' };
  }
  return { rating };
}

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const where = { status: 'approved' };
    if (req.query.product_id) {
      const id = String(req.query.product_id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(400).json({ message: 'Produit invalide' });
      }
      where.product_id = id;
    }
    if (req.query.shop === '1') where.product_id = null;
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));

    const rows = await Review.findAll({
      where,
      include: [
        { model: User, attributes: REVIEW_USER },
        { model: Product, attributes: ['id', 'name', 'image_url'] }
      ],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']],
      limit
    });

    const statsWhere = { status: 'approved' };
    if (where.product_id !== undefined) statsWhere.product_id = where.product_id;
    const stats = await Review.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('AVG', col('rating')), 'average']
      ],
      where: statsWhere,
      raw: true
    });

    let mine = false;
    let shopMine = false;
    if (req.user) {
      const mineWhere = { user_id: req.user.id };
      if (where.product_id !== undefined) mineWhere.product_id = where.product_id;
      const [mineRow, shopRow] = await Promise.all([
        Review.findOne({ where: mineWhere, attributes: ['id'] }),
        where.product_id === undefined
          ? Review.findOne({ where: { user_id: req.user.id, product_id: null }, attributes: ['id'] })
          : Promise.resolve(null)
      ]);
      mine = Boolean(mineRow);
      shopMine = Boolean(shopRow);
    }

    res.json({
      data: rows.map(toPublic),
      count: Number(stats?.count || 0),
      average: Number(Number(stats?.average || 0).toFixed(1)),
      mine,
      shopMine
    });
  } catch (err) {
    next(err);
  }
});

router.get('/manage', auth, authorize('admin', 'seller'), requirePermission('reviews.manage'), async (req, res, next) => {
  try {
    const rows = await Review.findAll({
      include: [
        { model: User, attributes: [...REVIEW_USER, 'email'] },
        { model: Product, attributes: ['id', 'name', 'image_url'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 200
    });
    res.json(rows.map(toAdmin));
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, writeLimiter, async (req, res, next) => {
  const parsedRating = parseRating(req.body?.rating);
  if (parsedRating.error) return res.status(400).json({ message: parsedRating.error });
  const parsedComment = parseComment(req.body?.comment);
  if (parsedComment.error) return res.status(400).json({ message: parsedComment.error });

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let productId = req.body?.product_id ? String(req.body.product_id) : null;
  if (productId) {
    if (!UUID.test(productId)) return res.status(400).json({ message: 'Produit invalide' });
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });
  } else {
    productId = null;
  }

  const already = await Review.findOne({
    where: productId
      ? { user_id: req.user.id, product_id: productId }
      : { user_id: req.user.id, product_id: { [Op.is]: null } }
  });
  if (already) {
    return res.status(409).json({
      message: productId
        ? 'Vous avez déjà publié un avis sur cet article.'
        : 'Vous avez déjà publié un témoignage.'
    });
  }

  try {
    const created = await Review.create({
      product_id: productId,
      user_id: req.user.id,
      rating: parsedRating.rating,
      comment: parsedComment.comment,
      status: 'approved'
    });

    const full = await Review.findByPk(created.id, {
      include: [
        { model: User, attributes: REVIEW_USER },
        { model: Product, attributes: ['id', 'name', 'image_url'] }
      ]
    });
    audit.log({
      req,
      action: 'review.create',
      entity: 'review',
      entityId: created.id,
      summary: productId
        ? `a publié un avis sur « ${full.Product?.name || 'un produit'} »`
        : 'a publié un témoignage boutique'
    });
    return res.status(201).json(toPublic(full));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Vous avez déjà publié cet avis.' });
    }
    return next(err);
  }
});

router.put('/:id', auth, authorize('admin', 'seller'), requirePermission('reviews.manage'), async (req, res) => {
  const review = await Review.findByPk(req.params.id);
  if (!review) return res.status(404).json({ message: 'Avis introuvable' });

  const patch = {};
  if (req.body.status && STATUSES.includes(req.body.status)) patch.status = req.body.status;
  if (req.body.featured !== undefined) patch.featured = Boolean(req.body.featured);

  if (patch.featured) {
    await Review.update({ featured: false }, { where: { featured: true, id: { [Op.ne]: review.id } } });
  }
  await review.update(patch);

  const full = await Review.findByPk(review.id, {
    include: [
      { model: User, attributes: [...REVIEW_USER, 'email'] },
      { model: Product, attributes: ['id', 'name', 'image_url'] }
    ]
  });
  if (patch.featured !== undefined) {
    audit.log({
      req,
      action: 'review.feature',
      entity: 'review',
      entityId: review.id,
      summary: patch.featured ? 'a mis un avis en avant sur l’accueil' : 'a retiré un avis de l’accueil'
    });
  }
  res.json(toAdmin(full));
});

router.delete('/:id', auth, authorize('admin', 'seller'), requirePermission('reviews.manage'), async (req, res) => {
  const review = await Review.findByPk(req.params.id);
  if (!review) return res.status(404).json({ message: 'Avis introuvable' });
  await review.destroy();
  audit.log({
    req,
    action: 'review.delete',
    entity: 'review',
    entityId: req.params.id,
    summary: 'a supprimé un avis'
  });
  res.json({ ok: true });
});

module.exports = router;
