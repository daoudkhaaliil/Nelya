// En production Docker/Railway, le reverse proxy sert le front et l'API sur le même domaine :
// ApiService utilise alors l'URL relative "/api". Laissez cette constante vide.
// Pour un backend sur un autre hôte, mettez l'origine complète (https://api.exemple.tn).
export const API_BASE_URL = '';

const RAILWAY_API_ORIGIN = 'https://nelya-production.up.railway.app';

/** Sur Vercel le proxy /api casse les uploads multipart (POST 500). On parle à Railway en direct. */
export function resolveApiOrigin(): string {
  const hardcoded = (API_BASE_URL || '').replace(/\/$/, '');
  if (hardcoded) return hardcoded;
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (
    host === 'www.nelyacosmetique.tn' ||
    host === 'nelyacosmetique.tn' ||
    host.endsWith('.vercel.app')
  ) {
    return RAILWAY_API_ORIGIN;
  }
  return '';
}
