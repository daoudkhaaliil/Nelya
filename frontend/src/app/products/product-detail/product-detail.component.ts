import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CrudService } from '../../services/crud.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';
import { FormatCurrencyPipe } from '../../pipes/format-currency.pipe';
import { BreadcrumbComponent } from '../../components/breadcrumb/breadcrumb.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { SettingsService } from '../../services/settings.service';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, FormsModule, ImageUrlPipe, FormatCurrencyPipe, BreadcrumbComponent, ProductCardComponent],
  template: `
    <div class="detail-page" *ngIf="product; else detailSkeleton">
      <div class="container">
        <div class="detail-crumbs">
          <app-breadcrumb [crumbs]="breadcrumbs"></app-breadcrumb>
        </div>

        <div class="detail-grid">
          <!-- GALERIE -->
          <div class="gallery">
            <div class="gallery-main" (mousemove)="zoom($event)" (mouseleave)="zoomed = false" (click)="openLightbox()" role="img" [attr.aria-label]="'Agrandir l\\'image de ' + product.name">
              <div class="gallery-img" [ngClass]="{zoomed: zoomed}" [ngStyle]="zoomStyle">
                <img [src]="(galleryImages[activeImage] | imageUrl)" [alt]="product.name" fetchpriority="high" decoding="async">
              </div>
              <div class="gallery-badge" *ngIf="product.category === 'Promotions'">PROMO</div>
              <button class="gallery-wish" [class.active]="wishlisted" (click)="$event.stopPropagation(); toggleWish()"
                [attr.aria-label]="wishlisted ? 'Retirer des favoris' : 'Ajouter aux favoris'">
                <mat-icon>{{ wishlisted ? 'favorite' : 'favorite_border' }}</mat-icon>
              </button>
              <button class="gallery-zoom-hint" (click)="$event.stopPropagation(); openLightbox()" aria-label="Afficher en plein écran">
                <mat-icon>zoom_out_map</mat-icon>
              </button>
            </div>
            <div class="gallery-thumbs" *ngIf="galleryImages.length > 1">
              <button *ngFor="let img of galleryImages; let i = index" class="gallery-thumb" [class.active]="i === activeImage"
                (click)="activeImage = i" [attr.aria-label]="'Voir l\\'image ' + (i + 1)">
                <img [src]="img | imageUrl" [alt]="'Aperçu ' + (i + 1)" loading="lazy" decoding="async">
              </button>
            </div>
          </div>

          <!-- INFOS -->
          <div class="info">
            <span class="info-category">{{ product.category }}<ng-container *ngIf="product.subcategory"> · {{ product.subcategory }}</ng-container></span>
            <h1 class="info-title">{{ product.name }}</h1>
            <div class="info-rating">
              <mat-icon *ngFor="let s of [1,2,3,4,5]">{{ s <= reviewAverage ? 'star' : 'star_border' }}</mat-icon>
              <span>{{ reviewCount ? (reviewAverage | number:'1.1-1') : '—' }} &middot; <button class="rating-link" (click)="scrollToReviews()">avis clients</button></span>
            </div>
            <p class="info-price">{{ unitPrice * quantity | formatCurrency }}</p>
            <p class="info-unit-price" *ngIf="quantity > 1">{{ unitPrice | formatCurrency }} l’unité</p>
            <p class="info-points" *ngIf="pointsForProduct > 0">
              <mat-icon>stars</mat-icon>
              +{{ pointsForProduct }} pts fidélité par unité
              <span *ngIf="quantity > 1"> ({{ pointsForProduct * quantity }} pts pour {{ quantity }})</span>
            </p>

            <div class="info-buy">
              <div class="qty-stepper">
                <button (click)="changeQty(-1)" aria-label="Diminuer la quantité" [disabled]="quantity <= 1">-</button>
                <span>{{ quantity }}</span>
                <button (click)="changeQty(1)" aria-label="Augmenter la quantité" [disabled]="product.stock > 0 && quantity >= product.stock">+</button>
              </div>
              <button mat-flat-button color="primary" class="buy-btn" (click)="addToCart()" [disabled]="product.stock === 0">
                <mat-icon>shopping_bag</mat-icon>
                {{ product.stock === 0 ? 'RUPTURE DE STOCK' : 'AJOUTER AU PANIER' }}
              </button>
            </div>

            <div class="stock-info" [class.out]="product.stock === 0">
              <mat-icon>{{ product.stock > 0 ? 'check_circle' : 'error_outline' }}</mat-icon>
              <span>{{ product.stock > 0 ? 'En stock, expédition sous 24h' : 'Rupture de stock' }}</span>
            </div>

            <div class="info-trust">
              <div class="trust-item"><mat-icon>local_shipping</mat-icon><span>Livraison<br><small>48h en Tunisie</small></span></div>
              <div class="trust-item"><mat-icon>lock</mat-icon><span>Paiement<br><small>100% sécurisé</small></span></div>
              <div class="trust-item"><mat-icon>recycling</mat-icon><span>Éco-friendly<br><small>Emballage recyclable</small></span></div>
            </div>

            <div class="info-details">
              <details>
                <summary><mat-icon>local_shipping</mat-icon> Livraison & Retours <mat-icon class="chev">expand_more</mat-icon></summary>
                <p>Expédition sous 24h ouvrées. Livraison offerte dès 150 TND partout en Tunisie. Satisfait ou remboursé sous 14 jours.</p>
              </details>
              <details>
                <summary><mat-icon>payment</mat-icon> Paiement sécurisé <mat-icon class="chev">expand_more</mat-icon></summary>
                <p>Espèces à la livraison ou carte bancaire. Vos transactions sont chiffrées et protégées.</p>
              </details>
              <details>
                <summary><mat-icon>eco</mat-icon> Engagement Nelya <mat-icon class="chev">expand_more</mat-icon></summary>
                <p>Ingrédients d'origine naturelle, formulations sans composants nocifs et packaging recyclable.</p>
              </details>
            </div>
          </div>
        </div>

        <!-- DESCRIPTION -->
        <section class="detail-description">
          <h2>La Description</h2>
          <div class="detail-desc-line"></div>
          <p class="desc-text">{{ product.description }}</p>
        </section>

        <!-- AVIS CLIENTS -->
        <section class="reviews" id="reviews">
          <div class="reviews-head">
            <div>
              <span class="reviews-eyebrow">Avis clients</span>
              <h2>Ce qu'en pensent nos clientes</h2>
              <div class="reviews-summary" *ngIf="reviewCount">
                <span class="reviews-note">{{ reviewAverage | number:'1.1-1' }}</span>
                <div class="reviews-stars"><mat-icon *ngFor="let s of [1,2,3,4,5]">{{ s <= reviewAverage ? 'star' : 'star_border' }}</mat-icon></div>
                <span class="reviews-count">{{ reviewCount }} avis vérifié{{ reviewCount > 1 ? 's' : '' }}</span>
              </div>
            </div>
            <button mat-stroked-button (click)="openReviewDialog()"><mat-icon>rate_review</mat-icon> ÉCRIRE UN AVIS</button>
          </div>

          <p class="reviews-empty" *ngIf="!reviews.length">Aucun avis pour le moment. Soyez la première à partager votre expérience.</p>
          <div class="reviews-grid">
            <div class="review-card" *ngFor="let r of reviews">
              <div class="review-stars">
                <mat-icon *ngFor="let s of [1,2,3,4,5]">{{ s <= r.rating ? 'star' : 'star_border' }}</mat-icon>
              </div>
              <p class="review-text">« {{ r.comment }} »</p>
              <div class="review-author">
                <span class="review-avatar">{{ r.authorInitial || r.author?.[0] }}</span>
                <div>
                  <strong>{{ r.author }}</strong>
                  <span class="review-role">Cliente vérifiée · {{ formatReviewDate(r.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- LIGHTBOX -->
      <div class="lightbox" *ngIf="lightboxOpen" (click)="closeLightbox()" role="dialog" aria-modal="true" aria-label="Image agrandie">
        <button class="lightbox-close" (click)="closeLightbox()" aria-label="Fermer"><mat-icon>close</mat-icon></button>
        <button class="lightbox-nav lightbox-prev" *ngIf="galleryImages.length > 1" (click)="$event.stopPropagation(); prevImage()" aria-label="Image précédente"><mat-icon>chevron_left</mat-icon></button>
        <img class="lightbox-img" [src]="(galleryImages[activeImage] | imageUrl)" [alt]="product.name" (click)="$event.stopPropagation()">
        <button class="lightbox-nav lightbox-next" *ngIf="galleryImages.length > 1" (click)="$event.stopPropagation(); nextImage()" aria-label="Image suivante"><mat-icon>chevron_right</mat-icon></button>
        <div class="lightbox-count" *ngIf="galleryImages.length > 1">{{ activeImage + 1 }} / {{ galleryImages.length }}</div>
      </div>

      <!-- PRODUITS LIÉS -->
      <section class="related" *ngIf="related.length">
        <div class="container">
          <div class="related-head">
            <span class="related-eyebrow">Vous aimerez aussi</span>
            <h2>Complétez votre rituel</h2>
            <div class="related-line"></div>
          </div>
          <div class="related-grid">
            <app-product-card *ngFor="let p of related" [product]="p"></app-product-card>
          </div>
        </div>
      </section>
    </div>

    <div class="detail-notfound" *ngIf="!product && loadError">
      <mat-icon>search_off</mat-icon>
      <h2>Produit introuvable</h2>
      <p>Ce produit n'existe plus ou a été retiré de la boutique.</p>
      <button mat-flat-button color="primary" routerLink="/collection">RETOUR À LA BOUTIQUE</button>
    </div>

    <ng-template #detailSkeleton>
      <div class="container detail-skeleton" *ngIf="!loadError">
        <div class="skeleton skeleton-text" style="width:200px;height:20px;"></div>
        <div class="detail-skeleton-grid">
          <div class="skeleton skeleton-media" style="aspect-ratio:4/5;"></div>
          <div class="detail-skeleton-body">
            <div class="skeleton skeleton-text" style="width:140px;height:16px;"></div>
            <div class="skeleton skeleton-text" style="width:70%;height:40px;"></div>
            <div class="skeleton skeleton-text" style="width:120px;height:28px;"></div>
            <div class="skeleton skeleton-text" style="width:100%;height:60px;"></div>
            <div class="skeleton skeleton-text" style="width:100%;height:60px;"></div>
          </div>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .detail-page { padding-top: 130px; }
    .container { max-width: 1440px; margin: 0 auto; padding: 0 40px; }
    .detail-crumbs { margin-bottom: 34px; }

    .detail-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 80px; align-items: start; }

    /* Galerie */
    .gallery-main {
      position: relative; border-radius: var(--radius-lg); overflow: hidden; background: var(--luxe-offwhite);
      cursor: zoom-in;
    }
    .gallery-img { transition: transform 0.25s ease-out; }
    .gallery-img.zoomed { transform: scale(2); }
    .gallery-img img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; pointer-events: none; }
    .gallery-badge {
      position: absolute; top: 18px; left: 18px; background: var(--luxe-gold); color: var(--luxe-black);
      padding: 6px 14px; font-size: 0.68rem; font-weight: 700; letter-spacing: 2px; border-radius: var(--radius-pill);
    }
    .gallery-wish {
      position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%;
      border: none; cursor: pointer; background: rgba(255,255,255,0.92); box-shadow: var(--shadow-sm);
      display: flex; align-items: center; justify-content: center; color: var(--luxe-charcoal);
      transition: transform 0.3s ease, color 0.3s ease;
    }
    .gallery-wish mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .gallery-wish:hover { transform: scale(1.1); color: var(--luxe-crimson); }
    .gallery-wish.active { color: var(--luxe-crimson); }
    .gallery-zoom-hint {
      position: absolute; bottom: 14px; right: 14px; width: 40px; height: 40px; border-radius: 50%;
      border: none; cursor: pointer; background: rgba(255,255,255,0.85); box-shadow: var(--shadow-sm);
      display: flex; align-items: center; justify-content: center; color: var(--luxe-charcoal);
      opacity: 0; transition: opacity 0.3s ease;
    }
    .gallery-zoom-hint mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .gallery-main:hover .gallery-zoom-hint { opacity: 1; }
    .gallery-thumbs { display: flex; gap: 14px; margin-top: 16px; }
    .gallery-thumb {
      width: 84px; height: 100px; border-radius: var(--radius-sm); overflow: hidden;
      border: 2px solid transparent; cursor: pointer; padding: 0; background: var(--luxe-offwhite);
      transition: border-color 0.3s ease, transform 0.3s ease;
    }
    .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .gallery-thumb.active { border-color: var(--luxe-gold); }
    .gallery-thumb:hover { transform: translateY(-3px); }

    /* Infos */
    .info { position: sticky; top: 100px; align-self: start; padding-top: 10px; }
    .info-category { font-size: 0.75rem; letter-spacing: 4px; text-transform: uppercase; color: var(--luxe-gold); font-weight: 600; }
    .info-title { font-family: var(--font-heading); font-size: clamp(2.2rem, 4vw, 3.2rem); color: var(--luxe-black); margin: 16px 0 12px; font-weight: 500; line-height: 1.1; }
    .info-rating { display: flex; align-items: center; gap: 4px; margin-bottom: 18px; }
    .info-rating mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }
    .info-rating span { font-size: 0.8rem; color: var(--luxe-text-muted); margin-left: 6px; }
    .rating-link { background: none; border: none; padding: 0; cursor: pointer; color: var(--luxe-text-muted); text-decoration: underline; font-size: 0.8rem; }
    .rating-link:hover { color: var(--luxe-gold); }
    .info-price { font-size: 2rem; color: var(--luxe-black); font-weight: 500; margin: 0 0 4px; }
    .info-unit-price { margin: 0 0 10px; font-size: 0.88rem; color: var(--luxe-text-muted); font-weight: 400; }
    .info-points {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      color: var(--luxe-gold); font-size: 0.88rem; font-weight: 600; margin: 0 0 24px;
    }
    .info-points mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .info-buy { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
    .qty-stepper { display: flex; align-items: center; border: 1px solid var(--luxe-border); border-radius: var(--radius-pill); overflow: hidden; }
    .qty-stepper button {
      width: 46px; height: 54px; border: none; background: none; cursor: pointer;
      font-size: 1.3rem; color: var(--luxe-charcoal); transition: color 0.3s ease, background 0.3s ease;
    }
    .qty-stepper button:hover:not(:disabled) { color: var(--luxe-gold); background: var(--luxe-offwhite); }
    .qty-stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
    .qty-stepper span { width: 48px; text-align: center; font-weight: 600; font-size: 1.05rem; }
    .buy-btn { flex: 1; height: 54px; letter-spacing: 2px; font-size: 0.82rem; }
    .buy-btn mat-icon { margin-right: 8px; }

    .stock-info { display: flex; align-items: center; gap: 10px; color: var(--luxe-success); font-size: 0.88rem; font-weight: 500; letter-spacing: 0.5px; }
    .stock-info.out { color: var(--luxe-crimson); }
    .stock-info mat-icon { font-size: 19px; width: 19px; height: 19px; }

    .info-trust { display: flex; gap: 26px; margin-top: 40px; padding-top: 30px; border-top: 1px solid var(--luxe-border); }
    .trust-item { display: flex; align-items: center; gap: 12px; }
    .trust-item mat-icon { color: var(--luxe-gold); font-size: 28px; width: 28px; height: 28px; }
    .trust-item span { font-size: 0.78rem; color: var(--luxe-black); font-weight: 600; line-height: 1.3; text-transform: uppercase; letter-spacing: 0.5px; }
    .trust-item small { display: block; font-weight: 300; color: var(--luxe-text-muted); text-transform: none; font-size: 0.74rem; }

    .info-details { margin-top: 34px; border-top: 1px solid var(--luxe-border); }
    .info-details details { border-bottom: 1px solid var(--luxe-border); }
    .info-details summary {
      list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px;
      padding: 18px 0; font-size: 0.85rem; font-weight: 600; color: var(--luxe-black);
      letter-spacing: 1px; text-transform: uppercase; transition: color 0.3s ease;
    }
    .info-details summary::-webkit-details-marker { display: none; }
    .info-details summary:hover { color: var(--luxe-gold); }
    .info-details summary mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--luxe-gold); }
    .info-details summary .chev { margin-left: auto; color: var(--luxe-text-muted); transition: transform 0.3s ease; }
    .info-details details[open] summary .chev { transform: rotate(180deg); }
    .info-details details p { margin: 0 0 18px; color: var(--luxe-text-muted); line-height: 1.8; font-size: 0.92rem; font-weight: 300; }

    /* Description */
    .detail-description { margin-top: 110px; }
    .detail-description h2 { font-family: var(--font-heading); font-size: 1.8rem; color: var(--luxe-black); font-weight: 500; }
    .detail-desc-line { width: 40px; height: 2px; background: var(--luxe-gold); margin: 18px 0 26px; border-radius: 2px; }
    .desc-text { color: var(--luxe-text-muted); line-height: 2; font-size: 1.05rem; white-space: pre-line; font-weight: 300; max-width: 900px; }

    /* Avis */
    .reviews { margin-top: 110px; }
    .reviews-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; flex-wrap: wrap; margin-bottom: 46px; }
    .reviews-eyebrow { font-size: 0.75rem; letter-spacing: 5px; text-transform: uppercase; color: var(--luxe-gold); font-weight: 600; }
    .reviews-head h2 { font-family: var(--font-heading); font-size: 2rem; color: var(--luxe-black); margin: 14px 0 20px; font-weight: 500; }
    .reviews-summary { display: flex; align-items: center; gap: 14px; }
    .reviews-note { font-family: var(--font-heading); font-size: 2.4rem; color: var(--luxe-black); }
    .reviews-stars, .review-stars { display: flex; gap: 3px; }
    .reviews-stars mat-icon, .review-stars mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--luxe-gold); }
    .reviews-count { color: var(--luxe-text-muted); font-size: 0.85rem; }
    .reviews-empty { color: var(--luxe-text-muted); font-weight: 300; margin: 0 0 20px; }
    .reviews-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 30px; }
    .review-card { background: var(--luxe-white); border: 1px solid var(--luxe-border); border-radius: var(--radius-lg); padding: 30px; display: flex; flex-direction: column; gap: 18px; transition: box-shadow 0.3s ease, transform 0.3s ease; }
    .review-card:hover { box-shadow: var(--shadow-elevated); transform: translateY(-3px); }
    .review-text { color: var(--luxe-charcoal); line-height: 1.9; font-weight: 300; margin: 0; }
    .review-author { display: flex; align-items: center; gap: 14px; margin-top: auto; }
    .review-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--luxe-black), #333); color: var(--luxe-gold); display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .review-author strong { color: var(--luxe-black); font-size: 0.92rem; display: block; }
    .review-role { font-size: 0.75rem; color: var(--luxe-text-muted); }

    /* Lightbox */
    .lightbox { position: fixed; inset: 0; z-index: 1200; background: rgba(10,10,10,0.94); display: flex; align-items: center; justify-content: center; animation: fadeIn 0.25s ease; }
    .lightbox-img { max-width: 86vw; max-height: 86vh; object-fit: contain; border-radius: var(--radius-md); box-shadow: var(--shadow-modal); }
    .lightbox-close { position: absolute; top: 24px; right: 24px; width: 48px; height: 48px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: var(--luxe-white); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s ease; }
    .lightbox-close:hover { background: var(--luxe-gold); color: var(--luxe-black); }
    .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 54px; height: 54px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: var(--luxe-white); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s ease; }
    .lightbox-nav:hover { background: var(--luxe-gold); color: var(--luxe-black); }
    .lightbox-prev { left: 24px; }
    .lightbox-next { right: 24px; }
    .lightbox-count { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 0.85rem; letter-spacing: 2px; }

    /* Not found */
    .detail-notfound { text-align: center; padding: 180px 20px 80px; min-height: 60vh; }
    .detail-notfound mat-icon { font-size: 64px; width: 64px; height: 64px; color: var(--luxe-gold); }
    .detail-notfound h2 { font-family: var(--font-heading); color: var(--luxe-black); margin: 18px 0 8px; font-size: 1.6rem; }
    .detail-notfound p { color: var(--luxe-text-muted); margin-bottom: 28px; font-weight: 300; }

    /* Liés */
    .related { margin-top: 110px; background: var(--luxe-offwhite); padding: 100px 0; border-top: 1px solid var(--luxe-border); }
    .related-head { text-align: center; margin-bottom: 60px; }
    .related-eyebrow { font-size: 0.75rem; letter-spacing: 5px; text-transform: uppercase; color: var(--luxe-gold); font-weight: 600; }
    .related-head h2 { font-family: var(--font-heading); font-size: 2.2rem; color: var(--luxe-black); margin: 16px 0 0; font-weight: 500; }
    .related-line { width: 46px; height: 2px; background: var(--luxe-gold); margin: 22px auto 0; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 34px; }

    /* Skeleton */
    .detail-skeleton { padding-top: 150px; display: flex; flex-direction: column; gap: 40px; }
    .detail-skeleton-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
    .detail-skeleton-body { display: flex; flex-direction: column; gap: 20px; padding-top: 20px; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 960px) {
      .detail-page { padding-top: 110px; }
      .detail-grid { grid-template-columns: 1fr; gap: 50px; }
      .gallery { order: 1; }
      .info { position: relative; top: 0; order: 2; }
      .detail-skeleton-grid { grid-template-columns: 1fr; }
      .info-trust { flex-wrap: wrap; }
      .gallery-main { cursor: zoom-in; }
      .gallery-zoom-hint { opacity: 1; }
      .lightbox-img { max-width: 94vw; max-height: 90vh; }
      .container { padding: 0 20px; }
    }
  `]
})
export class ProductDetailComponent implements OnInit {
  product: any;
  related: any[] = [];
  galleryImages: string[] = [];
  activeImage = 0;
  quantity = 1;
  wishlisted = false;
  zoomed = false;
  zoomX = 50;
  zoomY = 50;
  lightboxOpen = false;
  loadError = false;
  reviews: any[] = [];
  reviewCount = 0;
  reviewAverage = 0;
  alreadyReviewed = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private crud: CrudService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private settings: SettingsService,
    private api: ApiService,
    private auth: AuthService
  ) {}

  get unitPrice(): number {
    return Number(this.product?.price) || 0;
  }

  get pointsForProduct(): number {
    return this.settings.pointsForPrice(this.product?.price);
  }

  get breadcrumbs() {
    const crumbs: any[] = [{ label: 'Boutique', url: '/collection' }];
    if (this.product?.category) crumbs.push({ label: this.product.category, url: '/collection', queryParams: { cat: this.product.category } });
    if (this.product?.subcategory) {
      crumbs.push({
        label: this.product.subcategory,
        url: '/collection',
        queryParams: { cat: this.product.category, sub: this.product.subcategory }
      });
    }
    crumbs.push({ label: this.product.name });
    return crumbs;
  }

  get zoomStyle() {
    return {
      'transform-origin': `${this.zoomX}% ${this.zoomY}%`,
      transform: this.zoomed ? 'scale(2)' : 'scale(1)'
    };
  }

  @HostListener('window:keydown.escape', [])
  onEscape() {
    if (this.lightboxOpen) this.lightboxOpen = false;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.crud.getById<any>('products', id).subscribe({
      next: data => {
        this.product = data;
        this.galleryImages = Array.isArray(data.images) && data.images.length ? data.images : [data.image_url];
        this.wishlisted = this.wishlistService.isWishlisted(String(data.id));
        this.loadRelated();
        this.loadReviews();
      },
      error: () => { this.loadError = true; }
    });
  }

  loadRelated() {
    if (!this.product?.category) return;
    // Cinq pour pouvoir en retirer le produit affiché et en garder quatre.
    this.crud.getPage<any>('products', { category: this.product.category, limit: 5 }).subscribe({
      next: page => {
        this.related = page.data
          .filter(p => String(p.id) !== String(this.product.id))
          .slice(0, 4);
      },
      error: () => { this.related = []; }
    });
  }

  zoom(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    this.zoomX = ((e.clientX - r.left) / r.width) * 100;
    this.zoomY = ((e.clientY - r.top) / r.height) * 100;
    this.zoomed = true;
  }

  openLightbox() {
    this.zoomed = false;
    this.lightboxOpen = true;
  }

  closeLightbox() { this.lightboxOpen = false; }

  nextImage() {
    this.activeImage = (this.activeImage + 1) % this.galleryImages.length;
  }

  prevImage() {
    this.activeImage = (this.activeImage - 1 + this.galleryImages.length) % this.galleryImages.length;
  }

  scrollToReviews() {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' });
  }

  changeQty(delta: number) {
    const next = this.quantity + delta;
    if (next >= 1) {
      this.quantity = this.product.stock > 0 ? Math.min(next, this.product.stock) : next;
    }
  }

  addToCart() {
    for (let i = 0; i < this.quantity; i++) {
      this.cartService.addToCart(this.product);
    }
    const ref = this.snackBar.open(`${this.quantity} × ${this.product.name} ajouté au panier`, 'Voir le panier', { duration: 3500 });
    ref.onAction().subscribe(() => this.router.navigate(['/cart']));
  }

  toggleWish() {
    this.wishlisted = this.wishlistService.toggle(String(this.product.id));
    this.snackBar.open(
      this.wishlisted ? 'Ajouté à vos favoris' : 'Retiré de vos favoris',
      'Fermer', { duration: 2000 }
    );
  }

  openReviewDialog() {
    if (!this.auth.isLoggedIn) {
      this.snackBar.open('Connectez-vous pour laisser un avis.', 'Connexion', { duration: 4000 })
        .onAction().subscribe(() => this.router.navigate(['/auth/login']));
      return;
    }
    if (this.alreadyReviewed) {
      this.snackBar.open('Vous avez déjà publié un avis sur cet article.', 'Fermer', { duration: 3500 });
      return;
    }
    void import('../review-dialog.component').then(({ ReviewDialogComponent }) => {
      const ref = this.dialog.open(ReviewDialogComponent, {
        width: '520px',
        panelClass: 'luxury-dialog'
      });
      ref.componentInstance.productName = this.product.name;
      ref.afterClosed().subscribe(result => {
        if (!result) return;
        this.api.post('reviews', { product_id: this.product.id, rating: result.rating, comment: result.comment }).subscribe({
          next: () => {
            this.snackBar.open('Merci, votre avis est publié.', 'Fermer', { duration: 3500 });
            this.loadReviews();
          },
          error: (err) => this.snackBar.open(err?.error?.message || 'Impossible de publier l’avis', 'Fermer', { duration: 4000 })
        });
      });
    });
  }

  formatReviewDate(value: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  private loadReviews() {
    if (!this.product?.id) return;
    this.api.get<any>('reviews', { product_id: this.product.id, limit: 24 }).subscribe({
      next: (page) => {
        this.reviews = page.data || [];
        this.reviewCount = Number(page.count || 0);
        this.reviewAverage = Number(page.average || 0);
        this.alreadyReviewed = Boolean(page.mine);
      },
      error: () => { this.reviews = []; }
    });
  }
}
