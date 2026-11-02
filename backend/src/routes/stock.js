const express = require('express');
const { auth, authorize, requirePermission } = require('../middlewares/auth');
const { Product, sequelize } = require('../models');
const audit = require('../services/auditService');

const router = express.Router();
const MAX_STOCK = 100000;

function parseStockInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

// Agrégats pour le tableau de bord stock (admin / vendeur).
router.get('/stock-summary', auth, authorize('admin', 'seller'), async (req, res, next) => {
  try {
    const low = Math.min(1000, Math.max(1, Number.parseInt(req.query.low, 10) || 10));
    const [row] = await sequelize.query(
      `SELECT
         COUNT(*)::int AS sku_count,
         COALESCE(SUM(stock), 0)::int AS units,
         COUNT(*) FILTER (WHERE stock <= 0)::int AS out_of_stock,
         COUNT(*) FILTER (WHERE stock > 0 AND stock <= :low)::int AS low_stock
       FROM products`,
      { replacements: { low }, type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      skuCount: Number(row?.sku_count || 0),
      units: Number(row?.units || 0),
      outOfStock: Number(row?.out_of_stock || 0),
      lowStock: Number(row?.low_stock || 0),
      lowThreshold: low
    });
  } catch (error) {
    next(error);
  }
});

// Ajustement isolé : { stock } pose la quantité, { delta } l'incrémente (verrou ligne).
router.patch('/:id/stock', auth, authorize('admin', 'seller'), requirePermission('stock.manage'), async (req, res) => {
  try {
    const updated = await sequelize.transaction(async (t) => {
      const product = await Product.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!product) return null;

      let next;
      if (req.body.delta !== undefined && req.body.delta !== null && req.body.delta !== '') {
        const delta = parseStockInt(req.body.delta);
        if (!Number.isInteger(delta) || delta === 0) {
          throw new Error('Le delta doit être un entier non nul.');
        }
        next = Number(product.stock || 0) + delta;
      } else {
        next = parseStockInt(req.body.stock);
        if (!Number.isInteger(next)) {
          throw new Error('Indiquez une quantité entière (stock) ou un delta.');
        }
      }

      if (next < 0) {
        throw new Error('Le stock ne peut pas être négatif.');
      }
      if (next > MAX_STOCK) {
        throw new Error(`Le stock ne peut pas dépasser ${MAX_STOCK}.`);
      }

      await product.update({ stock: next }, { transaction: t });
      return product;
    });

    if (!updated) return res.status(404).json({ message: 'Produit introuvable' });
    audit.log({
      req,
      action: 'stock.adjust',
      entity: 'stock',
      entityId: updated.id,
      summary: `a ajusté le stock de « ${updated.name} » à ${updated.stock}`
    });
    res.json({ id: updated.id, name: updated.name, stock: updated.stock });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Impossible de mettre à jour le stock' });
  }
});

module.exports = router;
