const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { auth, optionalAuth, authorize } = require('../middlewares/auth');
const { Order, OrderItem, Product, User, sequelize } = require('../models');
const whatsappService = require('../services/whatsappService');
const settingsService = require('../services/settingsService');
const loyaltyService = require('../services/loyaltyService');
const orderNotify = require('../services/orderNotify');
const { newPublicToken, isPublicToken, toPublicOrder, trackingUrl, parseExtraFields, orderReference } = require('../utils/orderPublic');
const audit = require('../services/auditService');

function withParsedExtra(order) {
  const json = typeof order?.toJSON === 'function' ? order.toJSON() : { ...order };
  json.extra_fields = parseExtraFields(json.extra_fields);
  return json;
}

// Le client associé à une commande était inclus en entier, donc avec le hash bcrypt
// de son mot de passe. On ne remonte que les champs affichés par l'interface.
const ORDER_USER_ATTRIBUTES = ['id', 'first_name', 'last_name', 'email', 'loyalty_points'];
const isStaff = (user) => user && (user.role === 'admin' || user.role === 'seller');
const orderIncludes = (user) => {
  const staff = isStaff(user);
  const itemInclude = {
    model: OrderItem,
    as: 'items',
    include: [staff ? { model: Product } : { model: Product, attributes: { exclude: ['cost_price'] } }]
  };
  if (!staff) itemInclude.attributes = { exclude: ['cost_price'] };
  return [
    { model: User, as: 'User', attributes: ORDER_USER_ATTRIBUTES },
    itemInclude
  ];
};

// Les commandes invité sont anonymes et décrémentent le stock : on plafonne par IP.
const guestOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: (req) => Boolean(req.user),
  message: { message: 'Trop de commandes depuis cette adresse. Réessayez plus tard.' }
});

// Create a new order – authenticated users, plus guests when the shop allows it.
// [SEC-FIX] Le montant est calculé côté serveur à partir des prix en base.
// L'utilisateur est déduit du token (jamais du body). Les items sont créés.
router.post('/', optionalAuth, guestOrderLimiter, async (req, res) => {
  const { items, shipping_address, phone, notes, guest_name, guest_email, extra_fields } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item' });
  }

  const checkoutFields = await settingsService.getCheckoutFields();
  const field = (id) => settingsService.fieldById(checkoutFields, id);
  const isOn = (id) => {
    const f = field(id);
    return Boolean(f && f.enabled);
  };
  const must = (id) => {
    const f = field(id);
    return Boolean(f && f.enabled && f.required);
  };

  let guest = null;
  if (!req.user) {
    if (!(await settingsService.getGuestCheckout())) {
      return res.status(401).json({ message: 'Veuillez vous connecter pour valider votre commande.' });
    }
    const name = String(guest_name || '').trim() || (isOn('guestName') ? '' : 'Invité');
    if (must('guestName') && !name) {
      return res.status(400).json({ message: 'Le nom est obligatoire pour commander sans compte.' });
    }
    const email = String(guest_email || '').trim();
    if (must('guestEmail') && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ message: 'Un email valide est obligatoire pour commander sans compte (récapitulatif et suivi).' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email invalide.' });
    }
    guest = { name: name || 'Invité', email };
  }

  const address = isOn('address') ? String(shipping_address || '').trim() : '';
  if (must('address') && !address) {
    return res.status(400).json({ message: 'L’adresse de livraison est obligatoire.' });
  }

  const remark = isOn('notes') ? String(notes || '').trim() : '';
  if (must('notes') && !remark) {
    return res.status(400).json({ message: 'La remarque est obligatoire.' });
  }

  let storedPhone = null;
  if (isOn('phone')) {
    const normalizedPhone = settingsService.normalizeWhatsAppNumber(phone);
    if (!normalizedPhone) {
      if (must('phone')) {
        return res.status(400).json({ message: 'Indiquez un numéro de téléphone tunisien valide (8 chiffres).' });
      }
    } else {
      storedPhone = `+${normalizedPhone}`;
    }
  }

  const customCatalog = checkoutFields.filter((f) => !f.builtin && f.enabled);
  const incomingExtra = Array.isArray(extra_fields) ? extra_fields : [];
  const extraById = new Map(incomingExtra.map((row) => [String(row?.id || ''), row]));
  const storedExtra = [];
  for (const custom of customCatalog) {
    const value = String(extraById.get(custom.id)?.value ?? '').trim().slice(0, 500);
    if (custom.required && !value) {
      return res.status(400).json({ message: `${custom.label} est obligatoire.` });
    }
    if (value) storedExtra.push({ id: custom.id, label: custom.label, value });
  }

  try {
    const newOrder = await sequelize.transaction(async (t) => {
      const orderItemsData = [];
      let total = 0;

      // Même identifiant deux fois dans le panier : on agrège avant le verrou,
      // sinon le second findByPk attendrait le verrou que la même transaction tient déjà.
      const quantities = new Map();
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Quantité invalide');
        }
        const id = String(item.product_id || '');
        if (!id) throw new Error('Produit introuvable');
        quantities.set(id, (quantities.get(id) || 0) + quantity);
      }

      // Ordre stable des verrous : deux commandes simultanées ne se croisent pas en deadlock.
      const productIds = [...quantities.keys()].sort();
      for (const productId of productIds) {
        const quantity = quantities.get(productId);
        const product = await Product.findByPk(productId, {
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!product) {
          throw new Error('Produit introuvable');
        }
        if (product.stock < quantity) {
          throw new Error(`Stock insuffisant pour "${product.name}"`);
        }
        const unitPrice = Number(product.price);
        const unitCost = Number(product.cost_price);
        total += unitPrice * quantity;
        orderItemsData.push({
          product_id: product.id,
          quantity,
          unit_price: unitPrice,
          cost_price: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0
        });
        await product.update({ stock: product.stock - quantity }, { transaction: t });
      }

      let pointsAwarded = 0;
      if (req.user && req.user.role === 'client') {
        const tiers = await settingsService.getLoyaltyTiers();
        pointsAwarded = loyaltyService.pointsForItems(orderItemsData, tiers);
      }

      const order = await Order.create({
        user_id: req.user ? req.user.id : null,
        guest_name: guest ? guest.name : null,
        guest_email: guest ? guest.email : null,
        public_token: newPublicToken(),
        total_amount: total.toFixed(2),
        shipping_address: address,
        phone: storedPhone,
        notes: remark || (storedPhone ? `Téléphone: ${storedPhone} | Paiement: Espèces à la livraison` : 'Paiement: Espèces à la livraison'),
        extra_fields: storedExtra.length ? JSON.stringify(storedExtra) : null,
        status: 'pending',
        points_awarded: pointsAwarded
      }, { transaction: t });

      await OrderItem.bulkCreate(
        orderItemsData.map(item => ({ ...item, order_id: order.id })),
        { transaction: t }
      );

      if (pointsAwarded > 0) {
        await User.increment(
          { loyalty_points: pointsAwarded },
          { where: { id: req.user.id }, transaction: t }
        );
      }

      return order;
    });

    // Fetch the full order with relations for the notification
    const fullOrder = await Order.findByPk(newOrder.id, { include: orderIncludes(req.user) });

    // Boutique + client (email / WhatsApp). L'échec d'un envoi ne casse pas la commande.
    whatsappService.sendOrderNotification(fullOrder).catch(err => console.error('[WhatsApp] send error', err));
    const notified = await orderNotify.notifyOrderCreated(fullOrder).catch((err) => {
      console.error('[Notify] send error', err);
      return { email: false, whatsapp: false };
    });

    const payload = withParsedExtra(fullOrder);
    payload.tracking_url = trackingUrl(fullOrder.public_token);
    payload.notified = notified;
    audit.log({
      req,
      action: 'order.create',
      entity: 'order',
      entityId: fullOrder.id,
      summary: `a passé la commande ${orderReference(fullOrder)} (${fullOrder.total_amount})`
    });
    return res.status(201).json(payload);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Erreur lors de la création de la commande' });
  }
});

// Update order status – admins & sellers only
const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

router.put('/:id', auth, authorize('admin', 'seller'), async (req, res) => {
  try {
    const allowedStatuses = ALLOWED_STATUSES;
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    if (req.body.status) {
      const needed = req.body.status === 'cancelled' ? 'orders.cancel' : 'orders.update_status';
      const allowed = await require('../services/permissionService').userHas(req.user.id, needed);
      if (!allowed) {
        return res.status(403).json({
          message: req.body.status === 'cancelled'
            ? 'Votre groupe n’autorise pas l’annulation des commandes.'
            : 'Votre groupe n’autorise pas le changement de statut.'
        });
      }
    }

    const updated = await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!order) return null;

      const nextStatus = req.body.status;
      const previousStatus = order.status;
      // Une annulation remet le stock ; on ne le fait qu'une fois.
      if (nextStatus === 'cancelled' && previousStatus !== 'cancelled') {
        const lines = await OrderItem.findAll({ where: { order_id: order.id }, transaction: t });
        const productIds = [...new Set(lines.map((line) => line.product_id))].sort();
        for (const productId of productIds) {
          const product = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });
          if (!product) continue;
          const qty = lines
            .filter((line) => line.product_id === productId)
            .reduce((sum, line) => sum + Number(line.quantity), 0);
          await product.update({ stock: product.stock + qty }, { transaction: t });
        }

        const awarded = Number(order.points_awarded) || 0;
        if (awarded > 0 && order.user_id) {
          const customer = await User.findByPk(order.user_id, { transaction: t, lock: t.LOCK.UPDATE });
          if (customer) {
            await customer.update({
              loyalty_points: Math.max(0, Number(customer.loyalty_points || 0) - awarded)
            }, { transaction: t });
          }
          await order.update({ points_awarded: 0 }, { transaction: t });
        }
      }

      if (nextStatus) {
        await order.update({ status: nextStatus }, { transaction: t });
      }
      return {
        id: order.id,
        previousStatus,
        nextStatus,
        statusChanged: Boolean(nextStatus && nextStatus !== previousStatus)
      };
    });

    if (!updated) return res.status(404).json({ message: 'Order not found' });
    const full = await Order.findByPk(updated.id, { include: orderIncludes(req.user) });
    if (updated.statusChanged) {
      orderNotify.notifyOrderStatus(full).catch(err => console.error('[Notify] status error', err));
      const labels = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };
      audit.log({
        req,
        action: updated.nextStatus === 'cancelled' ? 'order.cancel' : 'order.status',
        entity: 'order',
        entityId: full.id,
        summary: `a passé ${orderReference(full)} de « ${labels[updated.previousStatus] || updated.previousStatus} » à « ${labels[updated.nextStatus] || updated.nextStatus} »`,
        meta: { from: updated.previousStatus, to: updated.nextStatus }
      });
    }
    res.json(withParsedExtra(full));
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Erreur lors de la mise à jour' });
  }
});

// Get list of orders – admins & sellers see all, clients see only theirs
router.get('/', auth, async (req, res, next) => {
  try {
    const where = {};
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    // Profil « Mes commandes » : uniquement les achats du compte connecté,
    // même pour un admin / employé (sinon ils voient tout le magasin).
    if (req.user.role === 'client' || mine) {
      where.user_id = req.user.id;
    }
    if (req.query.status && ALLOWED_STATUSES.includes(String(req.query.status))) {
      where.status = req.query.status;
    }

    const paginated = req.query.page !== undefined || req.query.limit !== undefined;
    const listOptions = {
      where,
      include: orderIncludes(req.user),
      order: [['createdAt', 'DESC']]
    };

    if (!paginated) {
      const orders = await Order.findAll({ ...listOptions, limit: 200 });
      return res.json(orders.map(withParsedExtra));
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const { rows, count } = await Order.findAndCountAll({
      ...listOptions,
      limit,
      offset: (page - 1) * limit,
      distinct: true
    });
    return res.json({
      data: rows.map(withParsedExtra),
      total: count,
      page,
      limit,
      pages: Math.max(1, Math.ceil(count / limit))
    });
  } catch (err) {
    next(err);
  }
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Trop de requêtes. Réessayez dans quelques minutes.' }
});

// Suivi public : le secret est le jeton, pas l'identifiant interne.
router.get('/track/:token', trackLimiter, async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!isPublicToken(token)) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    const order = await Order.findOne({
      where: { public_token: token },
      include: orderIncludes()
    });
    if (!order) return res.status(404).json({ message: 'Commande introuvable' });
    res.json(toPublicOrder(order));
  } catch (err) {
    next(err);
  }
});

// Dernière commande + nombre en attente : pour le badge et le son dans l'admin.
router.get('/inbox', auth, authorize('admin', 'seller'), async (req, res, next) => {
  try {
    const [latest, pending] = await Promise.all([
      Order.findOne({
        attributes: ['id', 'createdAt', 'total_amount', 'guest_name'],
        include: [{ model: User, as: 'User', attributes: ['first_name', 'last_name'] }],
        order: [['createdAt', 'DESC']]
      }),
      Order.count({ where: { status: 'pending' } })
    ]);

    let customer = null;
    if (latest) {
      customer = latest.User
        ? `${latest.User.first_name} ${latest.User.last_name}`.trim()
        : (latest.guest_name || 'Invité');
    }

    res.json({
      latestId: latest?.id || null,
      createdAt: latest?.createdAt || null,
      totalAmount: latest?.total_amount || null,
      customer,
      pending
    });
  } catch (err) {
    next(err);
  }
});

// Get a single order – same access rules as list
router.get('/:id', auth, async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: orderIncludes(req.user) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.role === 'client' && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
