const express = require('express');
const { auth, authorize } = require('../middlewares/auth');
const { User, Order, OrderItem, Product, Review } = require('../models');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:id/fiche', auth, authorize('admin'), async (req, res, next) => {
  try {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return res.status(400).json({ message: 'Client invalide' });

    const user = await User.findByPk(id, {
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'loyalty_points', 'createdAt']
    });
    if (!user) return res.status(404).json({ message: 'Compte introuvable' });

    const orders = await Order.findAll({
      where: { user_id: user.id },
      include: [{
        model: OrderItem,
        as: 'items',
        attributes: { exclude: ['cost_price'] },
        include: [{ model: Product, attributes: ['id', 'name', 'image_url'] }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const reviews = await Review.findAll({
      where: { user_id: user.id },
      include: [{ model: Product, attributes: ['id', 'name', 'image_url'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const jsonOrders = orders.map((order) => (typeof order.toJSON === 'function' ? order.toJSON() : order));
    const active = jsonOrders.filter((o) => o.status !== 'cancelled');
    const spent = active.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const last = jsonOrders[0] || null;

    res.json({
      user: user.toJSON(),
      orders: jsonOrders,
      reviews: reviews.map((r) => {
        const json = typeof r.toJSON === 'function' ? r.toJSON() : r;
        return {
          id: json.id,
          rating: json.rating,
          comment: json.comment,
          product_name: json.Product?.name || null,
          createdAt: json.createdAt
        };
      }),
      stats: {
        orders: jsonOrders.length,
        spent: Number(spent.toFixed(2)),
        points: user.loyalty_points || 0
      },
      contact: {
        phone: last?.phone || null,
        address: last?.shipping_address || null
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
