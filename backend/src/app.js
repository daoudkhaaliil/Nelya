const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const createDynamicRouter = require('./services/dynamicRouter');
const rateLimit = require('express-rate-limit');

const app = express();

// Derrière Nginx, req.ip vaut sinon l'IP du proxy : tous les visiteurs partagent alors
// le même compteur et les limiteurs de débit protègent ou bloquent tout le monde en bloc.
app.set('trust proxy', 1);

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: process.env.NODE_ENV === 'production'
        ? ["'self'", "data:", "https:"]
        : ["'self'", "data:", "http://localhost:3000", "https://images.unsplash.com"],
    },
  },
}));
// [BUG-004 FIX] CORS restreint - mettre l'URL frontend dans ALLOWED_ORIGIN
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Origine CORS refusée'));
  },
  credentials: true
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.originalUrl === '/api/health',
  message: { message: 'Trop de requêtes. Réessayez dans une minute.' }
});
app.use('/api', apiLimiter);

// Images : d’abord le dossier persistant (volume Railway), puis les visuels du dépôt.
const { repoImgDir, persistentImgDir, ensureImgDirs } = require('./config/imgPaths');
ensureImgDirs();
const imgStatic = { maxAge: '7d', etag: true, lastModified: true };
app.use('/img', express.static(persistentImgDir, imgStatic));
if (persistentImgDir !== repoImgDir) {
  app.use('/img', express.static(repoImgDir, imgStatic));
}

// Upload d'images (produits) – admin & employés
app.use('/api/uploads', require('./routes/uploads'));

// Import CSV de produits – doit être monté avant le routeur dynamique
app.use('/api/products', require('./routes/productImport'));

// Agrégats du catalogue (/api/products/meta) – avant le routeur dynamique,
// sinon "meta" serait interprété comme un identifiant par la route /:id
app.use('/api/products', require('./routes/catalog'));
app.use('/api/products', require('./routes/stock'));

// Routes Dynamiques
app.use('/api/products', createDynamicRouter('Product'));
app.use('/api/categories', createDynamicRouter('Category'));
app.use('/api/users', require('./routes/userFiche'));
app.use('/api/users', createDynamicRouter('User'));
app.use('/api/reviews', require('./routes/reviews'));

// [SEC-FIX] Route commandes dédiée (calcul serveur du total, items, accès client)
app.use('/api/orders', require('./routes/orders'));

// Paramètres boutique (devise)
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));

// Auth Routes (à implémenter si séparées)
const authController = require('./controllers/AuthController');
const { validateRegister, validateLogin } = require('./middlewares/validation');
const { auth } = require('./middlewares/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limite chaque IP à 10 requêtes
  message: { message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes' }
});

app.post('/api/auth/register', authLimiter, validateRegister, authController.register);
app.post('/api/auth/login', authLimiter, validateLogin, authController.login);
app.get('/api/auth/me', auth, authController.me);

app.get('/', (req, res) => {
  res.json({ message: 'Nelya API is running' });
});

let lastDbOkAt = 0;
app.get('/api/health', async (req, res) => {
  try {
    const sequelize = require('./config/database');
    if (Date.now() - lastDbOkAt > 10000) {
      await sequelize.authenticate();
      lastDbOkAt = Date.now();
    }
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

// Sans ce gestionnaire, un next(error) depuis un contrôleur laissait la requête ouverte
// jusqu'au timeout du navigateur au lieu de répondre. Doit rester en dernier.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[error]', err.message);
  } else {
    console.error('[error]', err.stack || err.message);
  }
  if (res.headersSent) return;
  // Le détail de l'erreur peut révéler la structure de la base : réservé au développement.
  const payload = { message: 'Une erreur interne est survenue' };
  if (process.env.NODE_ENV !== 'production') {
    payload.error = err.message;
  }
  res.status(err.status || 500).json(payload);
});

module.exports = app;
