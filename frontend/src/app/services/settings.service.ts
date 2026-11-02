import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { BrandService, ClientConfig } from './brand.service';

export interface Currency {
  code: string;
  symbol: string;
  label?: string;
}

export interface WhatsAppSettings {
  /** Numéro de la boutique au format international sans "+", ex : 21622580632 */
  number: string;
  /** Le client peut envoyer le récapitulatif à la boutique (lien wa.me) */
  invite: boolean;
  notifyCustomer: boolean;
  /** Un fournisseur officiel (Meta ou Twilio) est configuré côté serveur */
  providerReady: boolean;
  /** Le serveur confirme lui-même au client : le site n'a pas à le rediriger */
  autoSend: boolean;
}

export interface LoyaltyTier {
  min: number;
  max: number;
  points: number;
}

export interface CheckoutField {
  id: string;
  type: 'text' | 'textarea' | 'email' | 'tel';
  label: string;
  enabled: boolean;
  required: boolean;
  builtin?: boolean;
  guestOnly?: boolean;
}

export interface StoreSettings {
  currency: Currency;
  guestCheckout: boolean;
  heroImage?: string;
  logo?: string;
  logoFull?: string;
  tagline?: string;
  identity?: ClientConfig;
  checkoutFields?: CheckoutField[];
  loyalty?: { tiers: LoyaltyTier[] };
  whatsapp: WhatsAppSettings;
}

export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&q=75&w=1200';
export const DEFAULT_LOGO = 'assets/images/nelya-mark.png';
export const DEFAULT_LOGO_FULL = 'assets/images/nelya.webp';
export const DEFAULT_TAGLINE =
  "L'excellence de la cosmétique naturelle tunisienne. Des soins formulés avec passion pour révéler votre beauté intérieure.";

const DEFAULT_CURRENCY: Currency = { code: 'EUR', symbol: '€', label: 'Euro' };
const DEFAULT_WHATSAPP: WhatsAppSettings = {
  number: '',
  invite: true,
  notifyCustomer: false,
  providerReady: false,
  autoSend: false
};

export interface PermissionDef {
  key: string;
  section: string;
  label: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  system?: boolean;
  permissions: string[];
}

export interface SettingsPayload {
  currency?: string;
  guestCheckout?: boolean;
  whatsappNumber?: string;
  whatsappInvite?: boolean;
  notifyCustomer?: boolean;
  callmebotKey?: string;
  ultramsgInstance?: string;
  ultramsgToken?: string;
  loyaltyTiers?: LoyaltyTier[];
  checkoutFields?: CheckoutField[];
  heroImage?: string;
  logo?: string;
  logoFull?: string;
  tagline?: string;
  identity?: ClientConfig;
  permissionGroups?: PermissionGroup[];
}

export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  { min: 0, max: 20, points: 10 },
  { min: 20, max: 50, points: 20 },
  { min: 50, max: 1000, points: 50 }
];

export const DEFAULT_CHECKOUT_FIELDS: CheckoutField[] = [
  { id: 'guestName', type: 'text', label: 'Nom et prénom', enabled: true, required: true, builtin: true, guestOnly: true },
  { id: 'guestEmail', type: 'email', label: 'Email', enabled: true, required: true, builtin: true, guestOnly: true },
  { id: 'address', type: 'textarea', label: 'Adresse de livraison', enabled: true, required: true, builtin: true },
  { id: 'phone', type: 'tel', label: 'Numéro de téléphone', enabled: true, required: true, builtin: true },
  { id: 'notes', type: 'textarea', label: 'Remarque', enabled: false, required: false, builtin: true }
];

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private currencySubject = new BehaviorSubject<Currency>(DEFAULT_CURRENCY);
  public currency$ = this.currencySubject.asObservable();

  private guestCheckoutSubject = new BehaviorSubject<boolean>(false);
  public guestCheckout$ = this.guestCheckoutSubject.asObservable();

  private whatsappSubject = new BehaviorSubject<WhatsAppSettings>(DEFAULT_WHATSAPP);
  public whatsapp$ = this.whatsappSubject.asObservable();

  private loyaltyTiersSubject = new BehaviorSubject<LoyaltyTier[]>(DEFAULT_LOYALTY_TIERS);
  public loyaltyTiers$ = this.loyaltyTiersSubject.asObservable();

  private checkoutFieldsSubject = new BehaviorSubject<CheckoutField[]>(DEFAULT_CHECKOUT_FIELDS);
  public checkoutFields$ = this.checkoutFieldsSubject.asObservable();

  private heroImageSubject = new BehaviorSubject<string>(DEFAULT_HERO_IMAGE);
  public heroImage$ = this.heroImageSubject.asObservable();

  private logoSubject = new BehaviorSubject<string>(DEFAULT_LOGO);
  public logo$ = this.logoSubject.asObservable();

  private logoFullSubject = new BehaviorSubject<string>(DEFAULT_LOGO_FULL);
  public logoFull$ = this.logoFullSubject.asObservable();

  private taglineSubject = new BehaviorSubject<string>(DEFAULT_TAGLINE);
  public tagline$ = this.taglineSubject.asObservable();

  constructor(private api: ApiService, private brand: BrandService) {}

  load(): Promise<void> {
    return firstValueFrom(this.api.get<StoreSettings>('settings'))
      .then(s => this.apply(s))
      .catch(() => {});
  }

  get currency(): Currency {
    return this.currencySubject.value;
  }

  get guestCheckout(): boolean {
    return this.guestCheckoutSubject.value;
  }

  get whatsapp(): WhatsAppSettings {
    return this.whatsappSubject.value;
  }

  get loyaltyTiers(): LoyaltyTier[] {
    return this.loyaltyTiersSubject.value;
  }

  get checkoutFields(): CheckoutField[] {
    return this.checkoutFieldsSubject.value;
  }

  get heroImage(): string {
    return this.heroImageSubject.value || DEFAULT_HERO_IMAGE;
  }

  get logo(): string {
    return this.logoSubject.value || DEFAULT_LOGO;
  }

  get logoFull(): string {
    return this.logoFullSubject.value || DEFAULT_LOGO_FULL;
  }

  get tagline(): string {
    return this.taglineSubject.value || DEFAULT_TAGLINE;
  }

  pointsForPrice(price: number): number {
    const value = Number(price);
    if (!Number.isFinite(value) || value < 0) return 0;
    const match = this.loyaltyTiers.find(tier => value >= tier.min && value <= tier.max);
    return match ? match.points : 0;
  }

  pointsForItems(items: Array<{ price?: number; unit_price?: number; quantity?: number }>): number {
    return (items || []).reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = item.unit_price ?? item.price ?? 0;
      return sum + this.pointsForPrice(price) * qty;
    }, 0);
  }

  setCurrency(code: string): Promise<Currency> {
    return this.save({ currency: code }).then(() => this.currency);
  }

  setGuestCheckout(enabled: boolean): Promise<boolean> {
    return this.save({ guestCheckout: enabled }).then(() => this.guestCheckout);
  }

  save(payload: SettingsPayload): Promise<void> {
    return firstValueFrom(this.api.putTo<StoreSettings>('settings', payload)).then(s => this.apply(s));
  }

  loadAccess(): Promise<{
    catalog: PermissionDef[];
    groups: PermissionGroup[];
    whatsappGateway?: {
      callmebotKey?: string;
      ultramsgInstance?: string;
      ultramsgToken?: string;
      ready?: boolean;
    };
  }> {
    return firstValueFrom(this.api.get('settings/access'));
  }

  testWhatsApp(phone: string): Promise<{ sent: boolean; to: string }> {
    return firstValueFrom(this.api.post<{ sent: boolean; to: string }>('settings/whatsapp-test', { phone }));
  }

  savePermissionGroups(groups: PermissionGroup[]): Promise<{ catalog: PermissionDef[]; groups: PermissionGroup[] }> {
    return firstValueFrom(this.api.putTo<StoreSettings & { access?: { catalog: PermissionDef[]; groups: PermissionGroup[] } }>('settings', {
      permissionGroups: groups
    })).then((res) => {
      this.apply(res);
      return res.access || { catalog: [], groups };
    });
  }

  private apply(settings: StoreSettings): void {
    if (settings?.currency) {
      this.currencySubject.next(settings.currency);
    }
    this.guestCheckoutSubject.next(Boolean(settings?.guestCheckout));
    this.whatsappSubject.next({ ...DEFAULT_WHATSAPP, ...(settings?.whatsapp || {}) });
    const tiers = settings?.loyalty?.tiers;
    this.loyaltyTiersSubject.next(Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_LOYALTY_TIERS);
    this.checkoutFieldsSubject.next(
      Array.isArray(settings?.checkoutFields) && settings.checkoutFields.length
        ? settings.checkoutFields
        : DEFAULT_CHECKOUT_FIELDS
    );
    if (settings?.heroImage) {
      this.heroImageSubject.next(settings.heroImage);
    }
    this.logoSubject.next(settings?.logo || DEFAULT_LOGO);
    this.logoFullSubject.next(settings?.logoFull || DEFAULT_LOGO_FULL);
    this.taglineSubject.next((settings?.tagline || '').trim() || DEFAULT_TAGLINE);
    if (settings?.identity) {
      this.brand.applyConfig(settings.identity);
      this.logoSubject.next(settings.identity.brand?.logo || this.logoSubject.value);
      this.logoFullSubject.next(settings.identity.brand?.logoFull || this.logoFullSubject.value);
      this.taglineSubject.next(settings.identity.copy?.footerBlurb || this.taglineSubject.value);
    }
  }
}
