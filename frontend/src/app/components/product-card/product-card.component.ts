import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';
import { FormatCurrencyPipe } from '../../pipes/format-currency.pipe';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule, ImageUrlPipe, FormatCurrencyPipe],
  template: `
    <div class="pcard" [routerLink]="['/products', product.id]">
      <div class="pcard-media" (mouseenter)="loadAlt()">
        <img [src]="product.image_url | imageUrl" [alt]="product.name" loading="lazy" decoding="async">
        <img *ngIf="altLoaded && secondImage" class="pcard-alt" [src]="secondImage | imageUrl" [alt]="product.name" decoding="async">
        <div class="pcard-badge" *ngIf="product.category === 'Promotions'">PROMO</div>
        <button class="pcard-wish" [class.active]="wishlisted"
          (click)="$event.stopPropagation(); toggleWish()"
          [attr.aria-label]="wishlisted ? 'Retirer des favoris' : 'Ajouter aux favoris'">
          <mat-icon>{{ wishlisted ? 'favorite' : 'favorite_border' }}</mat-icon>
        </button>
        <div class="pcard-overlay">
          <span>VOIR LE PRODUIT</span>
        </div>
      </div>
      <div class="pcard-body">
        <span class="pcard-category">{{ product.category }}</span>
        <h3 class="pcard-name">{{ product.name }}</h3>
        <div class="pcard-footer">
          <span class="pcard-price">{{ product.price | formatCurrency }}</span>
          <span class="pcard-pts" *ngIf="pointsForProduct > 0">+{{ pointsForProduct }} pts</span>
          <button class="pcard-cart" (click)="$event.stopPropagation(); addToCart()"
            [attr.aria-label]="'Ajouter ' + product.name + ' au panier'">
            <mat-icon>add_shopping_cart</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pcard {
      cursor: pointer;
      background: var(--luxe-white);
      border: 1px solid var(--luxe-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: transform 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .pcard:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-elevated);
      border-color: var(--luxe-gold);
    }
    .pcard-media { position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: var(--luxe-light-grey); }
    .pcard-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 1s ease, opacity 0.45s ease; }
    .pcard-media .pcard-alt { position: absolute; inset: 0; opacity: 0; }
    .pcard:hover .pcard-media img { transform: scale(1.05); }
    .pcard:hover .pcard-media .pcard-alt { opacity: 1; }
    .pcard-badge {
      position: absolute; top: 14px; left: 14px;
      background: var(--luxe-gold); color: var(--luxe-black);
      padding: 5px 12px; font-size: 0.68rem; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase; border-radius: var(--radius-pill);
    }
    .pcard-wish {
      position: absolute; top: 12px; right: 12px;
      width: 38px; height: 38px; border-radius: 50%;
      border: none; cursor: pointer;
      background: rgba(255,255,255,0.92);
      box-shadow: var(--shadow-sm);
      display: flex; align-items: center; justify-content: center;
      color: var(--luxe-charcoal);
      transition: transform 0.3s ease, color 0.3s ease, background 0.3s ease;
    }
    .pcard-wish mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .pcard-wish:hover { transform: scale(1.12); color: var(--luxe-crimson); }
    .pcard-wish.active { color: var(--luxe-crimson); background: var(--luxe-white); }
    .pcard-overlay {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(10,10,10,0.35); opacity: 0; transition: opacity 0.4s ease;
    }
    .pcard-overlay span { color: var(--luxe-white); font-size: 0.75rem; letter-spacing: 3px; font-weight: 500; text-transform: uppercase; border-bottom: 1px solid var(--luxe-gold); padding-bottom: 6px; }
    .pcard:hover .pcard-overlay { opacity: 1; }
    .pcard-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .pcard-category { font-size: 0.68rem; color: var(--luxe-text-muted); text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
    .pcard-name { font-size: 1.15rem; margin: 0; font-weight: 500; font-family: var(--font-heading); color: var(--luxe-black); line-height: 1.3; }
    .pcard-footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 6px; }
    .pcard-price { font-size: 1.05rem; color: var(--luxe-charcoal); font-weight: 600; }
    .pcard-pts { margin-right: auto; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.4px; color: var(--luxe-gold); }
    .pcard-cart {
      width: 42px; height: 42px; border-radius: 50%;
      border: 1px solid var(--luxe-border); background: var(--luxe-white);
      color: var(--luxe-charcoal); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
    }
    .pcard-cart mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .pcard-cart:hover { background: var(--luxe-black); color: var(--luxe-gold); border-color: var(--luxe-black); transform: translateY(-2px); }
    @media (prefers-reduced-motion: reduce) {
      .pcard, .pcard-media img, .pcard-overlay, .pcard-wish, .pcard-cart { transition: none; }
    }
  `]
})
export class ProductCardComponent implements OnInit {
  @Input() product: any;
  wishlisted = false;
  altLoaded = false;

  constructor(
    private cartService: CartService,
    private wishlistService: WishlistService,
    private snackBar: MatSnackBar,
    private settings: SettingsService
  ) {}

  get pointsForProduct(): number {
    return this.settings.pointsForPrice(this.product?.price);
  }

  get secondImage(): string {
    const gallery = this.product?.images;
    if (Array.isArray(gallery) && gallery.length > 1) return gallery[1];
    return '';
  }

  ngOnInit() {
    this.wishlisted = this.wishlistService.isWishlisted(this.product.id);
  }

  loadAlt() {
    if (this.secondImage) this.altLoaded = true;
  }

  addToCart() {
    this.cartService.addToCart(this.product);
    this.snackBar.open('Produit ajouté au panier', 'Fermer', { duration: 2500 });
  }

  toggleWish() {
    this.wishlisted = this.wishlistService.toggle(this.product.id);
    this.snackBar.open(
      this.wishlisted ? 'Ajouté à vos favoris' : 'Retiré de vos favoris',
      'Fermer',
      { duration: 2000 }
    );
  }
}
