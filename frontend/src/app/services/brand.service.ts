import { Injectable } from '@angular/core';

export interface ClientCopy {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  tagline?: string;
  heroTitle?: string;
  heroTitleEm?: string;
  heroSubtitle?: string;
  footerBlurb?: string;
  copyrightExtra?: string;
  contactTitle?: string;
  contactIntro?: string;
  atelierEyebrow?: string;
  atelierTitle?: string;
  atelierBody?: string;
  atelierImage?: string;
  atelierBullets?: string[];
  reviewsTitle?: string;
  reviewSubtitle?: string;
  trustKicker?: string;
}

export interface ClientConfig {
  slug: string;
  brand: {
    name: string;
    nameStart?: string;
    nameAccent?: string;
    legalName?: string;
    logo: string;
    logoFull?: string;
  };
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
  };
  contact: {
    email: string;
    emailOrders?: string;
    phoneDisplay: string;
    whatsapp: string;
    whatsappLabel: string;
    hours: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    country: string;
  };
  social: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
  };
  copy: ClientCopy;
}

export const DEFAULT_IDENTITY: ClientConfig = {
  slug: 'nelya',
  brand: {
    name: 'Nelya',
    nameStart: 'Nelya',
    nameAccent: '',
    legalName: 'Nelya',
    logo: 'assets/images/nelya-mark.png',
    logoFull: 'assets/images/nelya.webp'
  },
  colors: {
    primary: '#c6a04a',
    primaryHover: '#b38d2f',
    secondary: '#0a0a0a'
  },
  contact: {
    email: 'contact@nelya.tn',
    emailOrders: 'commandes@nelya.tn',
    phoneDisplay: '+216 22 580 632',
    whatsapp: '21622580632',
    whatsappLabel: 'WhatsApp',
    hours: 'Du lundi au samedi, 9h – 18h',
    addressLine1: 'Immeuble Khalsa, Hammam Chott',
    addressLine2: 'Tunisie 2084',
    city: 'Hammam Chott',
    country: 'Tunisie'
  },
  social: {
    facebook: 'https://www.facebook.com/profile.php?id=61551180391546',
    instagram: '',
    tiktok: ''
  },
  copy: {
    seoTitle: 'Nelya | Excellence Cosmétique & Soins de Luxe',
    seoDescription: 'Découvrez Nelya, votre boutique en ligne de produits esthétiques haut de gamme. Parfums, soins du visage et maquillage d\'exception.',
    seoKeywords: 'cosmétique, luxe, beauté, soins, parfum, maquillage, Nelya',
    tagline: 'NELYA — TUNISIE',
    heroTitle: "L'Éclat du",
    heroTitleEm: 'Naturel',
    heroSubtitle: 'Des soins botaniques d\'exception, formulés avec passion pour révéler votre beauté intérieure.',
    footerBlurb: "L'excellence de la cosmétique naturelle tunisienne. Des soins formulés avec passion pour révéler votre beauté intérieure.",
    copyrightExtra: 'Conçu avec soin en Tunisie.',
    contactTitle: "Contactez l'atelier Nelya",
    contactIntro: 'Une question sur nos soins, votre commande ou un conseil beauté ? Notre équipe vous répond sous 24h ouvrées.',
    atelierEyebrow: 'Savoir-faire',
    atelierTitle: "L'Atelier Nelya",
    atelierBody: "C'est ici, au cœur de notre atelier, que la magie opère. Nous sélectionnons les essences les plus pures pour créer des soins uniques, respectueux de votre peau et de la nature.",
    atelierImage: '/img/huile.jpg',
    atelierBullets: [
      "Ingrédients d'origine naturelle",
      'Formulation artisanale',
      'Production tunisienne'
    ],
    reviewsTitle: 'La voix de nos clientes',
    reviewSubtitle: 'Partagez votre expérience avec Nelya',
    trustKicker: '100 % naturel  ·  +30 soins exclusifs'
  }
};

@Injectable({ providedIn: 'root' })
export class BrandService {
  private cfg: ClientConfig = JSON.parse(JSON.stringify(DEFAULT_IDENTITY));

  get c(): ClientConfig { return this.cfg; }
  get name(): string { return this.cfg.brand.name; }
  get legalName(): string { return this.cfg.brand.legalName || this.cfg.brand.name; }
  get nameStart(): string { return this.cfg.brand.nameStart || this.cfg.brand.name; }
  get nameAccent(): string { return this.cfg.brand.nameAccent || ''; }
  get logoUrl(): string { return this.cfg.brand.logo || DEFAULT_IDENTITY.brand.logo; }
  get logoFullUrl(): string {
    return this.cfg.brand.logoFull || this.cfg.brand.logo || DEFAULT_IDENTITY.brand.logoFull || this.logoUrl;
  }
  get slug(): string { return this.cfg.slug || 'nelya'; }
  get copy(): ClientCopy { return this.cfg.copy || {}; }
  get contact() { return this.cfg.contact; }
  get social() { return this.cfg.social || {}; }
  get whatsappUrl(): string {
    const digits = String(this.cfg.contact.whatsapp || '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '#';
  }
  get year(): number { return new Date().getFullYear(); }
  get addressLine(): string {
    return [this.cfg.contact.addressLine1, this.cfg.contact.addressLine2].filter(Boolean).join(', ');
  }

  load(): Promise<void> {
    this.applyTheme();
    this.applyMeta();
    return Promise.resolve();
  }

  applyConfig(next?: Partial<ClientConfig> | null) {
    if (!next) return;
    this.cfg = {
      ...this.cfg,
      ...next,
      slug: next.slug || this.cfg.slug,
      brand: { ...this.cfg.brand, ...(next.brand || {}) },
      colors: { ...this.cfg.colors, ...(next.colors || {}) },
      contact: { ...this.cfg.contact, ...(next.contact || {}) },
      social: { ...this.cfg.social, ...(next.social || {}) },
      copy: { ...this.cfg.copy, ...(next.copy || {}) }
    };
    this.applyTheme();
    this.applyMeta();
  }

  snapshot(): ClientConfig {
    return JSON.parse(JSON.stringify(this.cfg));
  }

  applyTheme() {
    const root = document.documentElement;
    const { primary, primaryHover, secondary } = this.cfg.colors;
    root.style.setProperty('--luxe-gold', primary);
    root.style.setProperty('--luxe-gold-hover', primaryHover);
    root.style.setProperty('--luxe-gold-soft', hexToRgba(primary, 0.14));
    root.style.setProperty('--luxe-black', secondary);
    root.style.setProperty('--luxe-focus', primary);
  }

  applyMeta() {
    const title = this.copy.seoTitle || this.name;
    document.title = title;
    setMeta('description', this.copy.seoDescription);
    setMeta('keywords', this.copy.seoKeywords);
    setMeta('theme-color', this.cfg.colors.secondary);
    this.setFavicon(this.logoUrl);
  }

  private setFavicon(url: string) {
    const href = resolvePublicUrl(url);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = href.endsWith('.png') ? 'image/png' : 'image/webp';
    link.href = href;
  }
}

function resolvePublicUrl(value: string): string {
  if (!value) return DEFAULT_IDENTITY.brand.logo;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('assets/') || value.startsWith('/')) {
    return value.startsWith('/assets/') ? value.slice(1) : value;
  }
  return value;
}

function setMeta(name: string, content?: string) {
  if (!content) return;
  const selector = `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(198, 160, 74, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
