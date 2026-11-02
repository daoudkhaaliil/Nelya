const express = require('express');
const { Op } = require('sequelize');
const { escapeLikePattern } = require('../services/listQuery');
const { auth, authorize, requirePermission } = require('../middlewares/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get('/', auth, authorize('admin', 'seller'), requirePermission('audit.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.entity) where.entity = String(req.query.entity);
    if (req.query.action) where.action = String(req.query.action);
    const q = String(req.query.q || '').trim();
    if (q) {
      where[Op.or] = [
        { summary: { [Op.iLike]: `%${escapeLikePattern(q)}%` } },
        { actor_name: { [Op.iLike]: `%${escapeLikePattern(q)}%` } }
      ];
    }

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({
      data: rows.map((row) => {
        const json = row.toJSON();
        if (json.meta) {
          try { json.meta = JSON.parse(json.meta); } catch { json.meta = null; }
        }
        return json;
      }),
      total: count,
      page,
      limit,
      pages: Math.max(1, Math.ceil(count / limit))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
