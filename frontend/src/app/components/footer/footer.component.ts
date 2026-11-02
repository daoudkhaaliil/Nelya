import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BrandService } from '../../services/brand.service';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule, ImageUrlPipe],
  template: `
    <footer class="luxe-footer">
      <div class="luxe-certifications">
        <div class="luxe-cert"><mat-icon>spa</mat-icon><span><strong>100% Naturel</strong><small>Formules certifiées</small></span></div>
        <div class="luxe-cert"><mat-icon>flag</mat-icon><span><strong>Fabriqué en Tunisie</strong><small>Savoir-faire local</small></span></div>
        <div class="luxe-cert"><mat-icon>cruelty_free</mat-icon><span><strong>Non testé sur les animaux</strong><small>Éthique & responsable</small></span></div>
        <div class="luxe-cert"><mat-icon>recycling</mat-icon><span><strong>Emballage recyclable</strong><small>Éco-conçu</small></span></div>
      </div>

      <div class="luxe-footer-grid">
        <div class="luxe-footer-brand">
          <div class="luxe-logo">
            <img [src]="brand.logoUrl | imageUrl" [alt]="brand.name" loading="lazy" decoding="async" width="120" height="120">
          </div>
          <p>{{ brand.copy.footerBlurb }}</p>
          <div class="luxe-socials">
            <a *ngIf="brand.social.facebook" [href]="brand.social.facebook" target="_blank" rel="noopener" aria-label="Facebook">
              <mat-icon>facebook</mat-icon>
            </a>
            <a *ngIf="brand.social.instagram" [href]="brand.social.instagram" target="_blank" rel="noopener" aria-label="Instagram">
              <mat-icon>instagram</mat-icon>
            </a>
            <a *ngIf="brand.social.tiktok" [href]="brand.social.tiktok" target="_blank" rel="noopener" aria-label="TikTok">
              <mat-icon>music_note</mat-icon>
            </a>
          </div>
        </div>

        <div class="luxe-footer-col">
          <h4>EXPLORER</h4>
          <a routerLink="/collection">Tous les produits</a>
          <a routerLink="/collection" [queryParams]="{cat: 'Parfums'}">Parfums</a>
          <a routerLink="/collection" [queryParams]="{cat: 'Soins Naturels'}">Soins Naturels</a>
          <a routerLink="/collection" [queryParams]="{cat: 'Promotions'}">Promotions</a>
          <a routerLink="/wishlist">Mes favoris</a>
        </div>

        <div class="luxe-footer-col">
          <h4>MON COMPTE</h4>
          <a routerLink="/auth/login">Connexion</a>
          <a routerLink="/auth/register">Créer un compte</a>
          <a routerLink="/cart">Mon panier</a>
          <a routerLink="/profile">Mon profil</a>
        </div>

        <div class="luxe-footer-col luxe-footer-contact">
          <h4>NOUS CONTACTER</h4>
          <a routerLink="/contact" class="luxe-contact-link"><mat-icon>chat_outline</mat-icon> Page contact</a>
          <p><mat-icon>mail_outline</mat-icon> {{ brand.contact.email }}</p>
          <p><mat-icon>phone_in_talk</mat-icon> {{ brand.contact.phoneDisplay }}</p>
          <p><mat-icon>location_on</mat-icon> {{ brand.addressLine }}</p>
          <form class="luxe-newsletter" (submit)="subscribe(email.value); $event.preventDefault()">
            <input #email type="email" required placeholder="Votre e-mail" aria-label="Votre adresse e-mail">
            <button type="submit" aria-label="S'abonner à la newsletter"><mat-icon>arrow_forward</mat-icon></button>
          </form>
        </div>
      </div>

      <div class="luxe-payments">
        <span class="luxe-payments-label">Paiements acceptés</span>
        <div class="luxe-payment-icons">
          <span class="luxe-pay" title="Visa"><mat-icon>credit_card</mat-icon> VISA</span>
          <span class="luxe-pay" title="Mastercard"><mat-icon>credit_score</mat-icon> Mastercard</span>
          <span class="luxe-pay" title="Espèces à la livraison"><mat-icon>payments</mat-icon> Espèces à la livraison</span>
        </div>
      </div>

      <div class="luxe-copyright">
        &copy; {{ brand.year }} {{ brand.legalName }}. Tous droits réservés. &mdash; {{ brand.copy.copyrightExtra }}
      </div>
    </footer>
  `,
  styles: [`
    .luxe-footer {
      background: var(--luxe-black);
      color: var(--luxe-white);
      padding: 72px 40px 30px;
      margin-top: 0;
    }

    .luxe-certifications {
      max-width: 1440px; margin: 0 auto 80px; padding-bottom: 60px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px;
    }
    .luxe-cert { display: flex; align-items: center; gap: 18px; justify-content: center; }
    .luxe-cert mat-icon {
      font-size: 38px; width: 38px; height: 38px; color: var(--luxe-gold);
      padding: 12px; border: 1px solid rgba(198,160,74,0.35); border-radius: 50%;
      background: rgba(198,160,74,0.06); box-sizing: content-box;
    }
    .luxe-cert strong { display: block; color: var(--luxe-white); font-size: 0.95rem; letter-spacing: 0.5px; }
    .luxe-cert small { color: #9a9a9a; font-weight: 300; font-size: 0.78rem; }

    .luxe-footer-grid {
      max-width: 1440px; margin: 0 auto;
      display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 60px;
    }
    .luxe-logo { margin-bottom: 22px; }
    .luxe-logo img {
      height: 148px; width: auto; display: block;
      border-radius: 12px; background: #f7f4ec;
    }
    .luxe-footer-brand p { color: #9a9a9a; line-height: 1.8; font-weight: 300; font-size: 0.95rem; max-width: 360px; font-family: var(--font-body); }
    .luxe-socials { margin-top: 30px; display: flex; gap: 16px; }
    .luxe-socials a {
      width: 42px; height: 42px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      color: var(--luxe-white); text-decoration: none;
      transition: all 0.3s ease;
    }
    .luxe-socials a mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .luxe-socials a:hover { background: var(--luxe-gold); border-color: var(--luxe-gold); color: var(--luxe-black); transform: translateY(-3px); }
    .luxe-footer-col h4 {
      font-family: var(--font-body); font-size: 0.75rem; letter-spacing: 4px;
      margin-bottom: 28px; color: var(--luxe-white); font-weight: 700; text-transform: uppercase;
    }
    .luxe-footer-col a { display: block; color: #9a9a9a; text-decoration: none; margin-bottom: 14px; font-size: 0.9rem; font-weight: 300; transition: color 0.3s ease, padding-left 0.3s ease; }
    .luxe-footer-col a:hover { color: var(--luxe-gold); padding-left: 6px; }
    .luxe-contact-link { display: flex; align-items: center; gap: 10px; }
    .luxe-contact-link mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }
    .luxe-footer-contact p { display: flex; align-items: center; gap: 12px; color: #9a9a9a; margin-bottom: 14px; font-size: 0.9rem; font-weight: 300; }
    .luxe-footer-contact p mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }
    .luxe-newsletter { display: flex; gap: 8px; margin-top: 26px; }
    .luxe-newsletter input {
      flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.2);
      border-radius: var(--radius-pill); padding: 12px 18px; color: var(--luxe-white);
      outline: none; font-family: var(--font-body); font-size: 0.85rem; transition: border-color 0.3s ease;
    }
    .luxe-newsletter input:focus { border-color: var(--luxe-gold); }
    .luxe-newsletter input::placeholder { color: #777; }
    .luxe-newsletter button {
      width: 46px; height: 46px; border-radius: 50%; border: none; cursor: pointer;
      background: var(--luxe-gold); color: var(--luxe-black);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.3s ease, background 0.3s ease;
    }
    .luxe-newsletter button:hover { transform: translateX(4px); background: var(--luxe-white); }

    .luxe-payments {
      max-width: 1440px; margin: 60px auto 0; padding-top: 34px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center; gap: 26px; flex-wrap: wrap;
    }
    .luxe-payments-label { color: #777; font-size: 0.72rem; letter-spacing: 3px; text-transform: uppercase; }
    .luxe-payment-icons { display: flex; gap: 12px; align-items: center; }
    .luxe-pay {
      display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-sm);
      color: #ccc; font-size: 0.74rem; font-weight: 600; letter-spacing: 1px;
      transition: border-color 0.3s ease, color 0.3s ease, transform 0.3s ease;
    }
    .luxe-pay mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }
    .luxe-pay:hover { border-color: var(--luxe-gold); color: var(--luxe-gold); transform: translateY(-2px); }

    .luxe-copyright {
      max-width: 1440px; margin: 34px auto 0; padding-top: 28px;
      border-top: 1px solid rgba(255,255,255,0.1);
      color: #666; font-size: 0.72rem; letter-spacing: 2px;
      text-transform: uppercase; text-align: center;
    }
    @media (max-width: 960px) {
      .luxe-footer { padding: 70px 24px 24px; }
      .luxe-footer-grid { grid-template-columns: 1fr; gap: 45px; }
      .luxe-certifications { grid-template-columns: 1fr 1fr; gap: 26px; }
      .luxe-cert { justify-content: flex-start; }
    }
    @media (max-width: 520px) {
      .luxe-certifications { grid-template-columns: 1fr; }
    }
  `]
})
export class FooterComponent {
  constructor(private snackBar: MatSnackBar, public brand: BrandService) {}

  subscribe(email: string) {
    this.snackBar.open('Merci ! Votre inscription à la newsletter a bien été enregistrée.', 'Fermer', { duration: 3500 });
  }
}
