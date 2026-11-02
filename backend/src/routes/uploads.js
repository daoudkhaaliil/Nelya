const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { auth, authorize } = require('../middlewares/auth');

const router = express.Router();

const { persistentImgDir, repoImgDir, ensureImgDirs } = require('../config/imgPaths');
ensureImgDirs();

function writableUploadDir() {
  const candidates = [persistentImgDir, repoImgDir, '/tmp/nelya-img'];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      /* try next */
    }
  }
  return persistentImgDir;
}

// Formats acceptés en entrée. La sortie est toujours du WebP.
const ALLOWED_INPUT_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'];

// Une photo produit n'a pas besoin de plus : au-delà, le navigateur réduit l'image
// après l'avoir téléchargée entièrement, ce qui ne sert qu'à gaspiller de la bande passante.
const MAX_WIDTH = 1400;
const MAX_HEIGHT = 1400;
const WEBP_QUALITY = 80;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

// En mémoire : le fichier n'est jamais écrit sous le nom fourni par le client, et
// seul le résultat ré-encodé par sharp atteint le disque.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_INPUT_BYTES, files: 1 }
});

/**
 * Ré-encode l'image en WebP redimensionné.
 * sharp refuse tout ce qui n'est pas une image réelle : c'est une validation du
 * contenu, là où l'extension du nom de fichier ne prouvait rien.
 */
async function compressToWebp(buffer, { maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT } = {}) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const options = { animated: false, failOn: 'none' };
  // metadata() consomme le pipeline : il faut un second sharp() pour l'encodage.
  const metadata = await sharp(input, options).metadata();

  if (!ALLOWED_INPUT_FORMATS.includes(metadata.format)) {
    throw Object.assign(new Error(`Format d'image non supporté (${metadata.format || 'inconnu'})`), { status: 400 });
  }

  const output = await sharp(input, options)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { buffer: output.data, info: output.info, source: metadata };
}

// Upload d'image produit – admins & employés
router.post('/', auth, authorize('admin', 'seller'), (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? "L'image est trop volumineuse (25 Mo max). Compressez-la ou choisissez un fichier plus léger."
        : err.message;
      return res.status(400).json({ message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu (champ "image")' });
    }

    try {
      const purpose = String(req.body?.purpose || '').toLowerCase();
      const isHero = purpose === 'hero';
      const isLogo = purpose === 'logo' || purpose === 'lockup';
      const { buffer, info, source } = await compressToWebp(req.file.buffer, {
        maxWidth: isHero ? 2000 : isLogo ? 900 : MAX_WIDTH,
        maxHeight: isHero ? 1400 : isLogo ? 900 : MAX_HEIGHT
      });
      const filename = `${isHero ? 'hero' : isLogo ? 'logo' : 'product'}_${Date.now()}_${Math.round(Math.random() * 1e9)}.webp`;

      const destDir = writableUploadDir();
      await fs.promises.writeFile(path.join(destDir, filename), buffer);

      return res.status(201).json({
        url: `/img/${filename}`,
        width: info.width,
        height: info.height,
        bytes: buffer.length,
        originalBytes: req.file.size,
        // Ce que l'admin a gagné, pour rendre la compression visible dans l'interface.
        savedPercent: req.file.size > 0
          ? Math.max(0, Math.round((1 - buffer.length / req.file.size) * 100))
          : 0,
        sourceFormat: source.format
      });
    } catch (error) {
      console.error('[uploads]', error);
      if (error.status === 400) {
        return res.status(400).json({ message: error.message });
      }
      if (/Could not load the ["']sharp["'] module/i.test(error.message || '')) {
        return res.status(500).json({ message: "Le module d'images Sharp n'est pas chargé sur le serveur." });
      }
      if (/unsupported image format|Input buffer|VipsWebp|VipsJpeg|corrupt/i.test(error.message || '')) {
        return res.status(400).json({ message: "Le fichier envoyé n'est pas une image valide. Utilisez un PNG ou JPEG." });
      }
      if (error.code === 'ENOSPC' || error.code === 'EACCES' || error.code === 'ENOENT') {
        return res.status(500).json({ message: "Impossible d'enregistrer l'image sur le serveur (disque)." });
      }
      return res.status(500).json({
        message: error.message || "L'image n'a pas pu être traitée. Réessayez avec un PNG ou un JPEG."
      });
    }
  });
});

module.exports = router;
