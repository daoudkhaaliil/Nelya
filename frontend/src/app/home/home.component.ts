import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CrudService } from '../services/crud.service';
import { SettingsService, DEFAULT_HERO_IMAGE } from '../services/settings.service';
import { BrandService } from '../services/brand.service';
import { CategoryCount } from '../services/catalog.types';
import { CatalogService } from '../services/catalog.service';
import { ProductCardComponent } from '../components/product-card/product-card.component';
import { ImageUrlPipe } from '../pipes/image-url.pipe';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, ProductCardComponent, ImageUrlPipe],
  template: `
    <div class="home-wrapper">
      <!-- HERO -->
      <section class="luxe-hero">
        <div class="luxe-hero-media">
          <img [src]="heroImage | imageUrl" [alt]="brand.copy.heroSubtitle || brand.name" fetchpriority="high" decoding="async" width="1200" height="750">
        </div>
        <div class="luxe-hero-overlay"></div>
        <div class="luxe-hero-content">
          <span class="luxe-hero-tag fade-in-down">{{ brand.copy.tagline }}</span>
          <h1 class="luxe-hero-title fade-in">{{ brand.copy.heroTitle }}<br><em>{{ brand.copy.heroTitleEm }}</em></h1>
          <p class="luxe-hero-sub fade-in">{{ brand.copy.heroSubtitle }}</p>
          <div class="luxe-hero-cta fade-in">
            <a class="hero-btn" routerLink="/collection">Découvrir la boutique</a>
            <a class="luxe-hero-link" routerLink="/collection" [queryParams]="{cat: 'Soins'}">Nos soins <mat-icon>arrow_forward</mat-icon></a>
          </div>
        </div>
      </section>

      <section class="luxe-trust">
        <div class="container">
          <p class="trust-kicker">{{ brand.copy.trustKicker }}</p>
          <div class="trust-grid">
            <article class="trust-card">
              <span class="trust-ico"><mat-icon>local_shipping</mat-icon></span>
              <h3>Livraison partout</h3>
              <p>Expédition en 48 h partout en Tunisie.</p>
            </article>
            <article class="trust-card">
              <span class="trust-ico"><mat-icon>verified_user</mat-icon></span>
              <h3>Paiement sûr</h3>
              <p>Transaction protégée, espèces ou carte.</p>
            </article>
            <article class="trust-card">
              <span class="trust-ico"><mat-icon>recycling</mat-icon></span>
              <h3>Éco-responsable</h3>
              <p>Emballages pensés pour être recyclés.</p>
            </article>
            <article class="trust-card">
              <span class="trust-ico"><mat-icon>support_agent</mat-icon></span>
              <h3>Conseils d’expertes</h3>
              <p>Une équipe à l’écoute, du choix au rituel.</p>
            </article>
          </div>
        </div>
      </section>

      <!-- CATEGORIES -->
      <section class="luxe-categories container">
        <div class="luxe-sec-head">
          <span class="luxe-sec-eyebrow">Nos univers</span>
          <h2 class="luxe-sec-title">Explorez par envie</h2>
          <div class="luxe-sec-line"></div>
        </div>
        <div class="luxe-cat-grid stagger" *ngIf="categories.length">
          <a class="luxe-cat-tile" *ngFor="let cat of categories; trackBy: trackByName" [routerLink]="['/collection']" [queryParams]="{cat: cat.name}">
            <img [src]="cat.image | imageUrl" [alt]="cat.name" loading="lazy" decoding="async">
            <div class="luxe-cat-shade"></div>
            <div class="luxe-cat-info">
              <span class="luxe-cat-name">{{ cat.name }}</span>
              <span class="luxe-cat-link">Découvrir <mat-icon>arrow_forward</mat-icon></span>
            </div>
          </a>
        </div>
      </section>

      <!-- PRODUITS VEDETTES -->
      <section class="luxe-featured">
        <div class="container">
          <div class="luxe-sec-head">
            <span class="luxe-sec-eyebrow">Sélection</span>
            <h2 class="luxe-sec-title">Nos meilleurs choix</h2>
            <div class="luxe-sec-line"></div>
          </div>
          <div class="luxe-prod-grid stagger">
            <app-product-card *ngFor="let product of products; trackBy: trackById" [product]="product"></app-product-card>
          </div>
          <div class="luxe-see-all">
            <button mat-stroked-button routerLink="/collection">VOIR TOUTE LA COLLECTION</button>
          </div>
        </div>
      </section>

      <!-- ATELIER -->
      <section class="luxe-atelier">
        <div class="luxe-atelier-grid">
          <div class="luxe-atelier-media">
            <img [src]="(brand.copy.atelierImage || '/img/huile.jpg') | imageUrl" [alt]="brand.copy.atelierTitle" loading="lazy" decoding="async">
          </div>
          <div class="luxe-atelier-body">
            <span class="luxe-sec-eyebrow">{{ brand.copy.atelierEyebrow }}</span>
            <h2 class="luxe-atelier-title">{{ brand.copy.atelierTitle }}</h2>
            <p>{{ brand.copy.atelierBody }}</p>
            <ul class="luxe-atelier-list">
              <li *ngFor="let bullet of brand.copy.atelierBullets"><mat-icon>check_circle</mat-icon> {{ bullet }}</li>
            </ul>
            <button mat-button class="luxe-text-link" routerLink="/collection">DÉCOUVRIR NOS SECRETS <mat-icon>east</mat-icon></button>
          </div>
        </div>
      </section>

      <section class="luxe-voices">
        <div class="container">
          <div class="luxe-sec-head">
            <span class="luxe-sec-eyebrow">Témoignages</span>
            <h2 class="luxe-sec-title">{{ brand.copy.reviewsTitle }}</h2>
            <div class="luxe-sec-line"></div>
            <p class="voices-score" *ngIf="reviewCount">{{ reviewAverage | number:'1.1-1' }} / 5 · {{ reviewCount }} avis</p>
          </div>

          <div class="voices-grid">
            <article class="voice-card" *ngFor="let r of displayReviews; trackBy: trackByReview">
              <div class="luxe-stars">
                <mat-icon *ngFor="let s of [1,2,3,4,5]">{{ s <= r.rating ? 'star' : 'star_border' }}</mat-icon>
              </div>
              <p>« {{ r.comment }} »</p>
              <div class="voice-who">
                <span class="voice-avatar">{{ (r.authorInitial || r.author?.[0] || 'N') }}</span>
                <div>
                  <strong>{{ r.author }}</strong>
                  <small>{{ r.product_name || 'Témoignage boutique' }}</small>
                </div>
              </div>
            </article>
          </div>

          <div class="voices-cta">
            <button type="button" class="voice-link" (click)="openShopReview()">
              Laisser un témoignage <mat-icon>east</mat-icon>
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-wrapper { background: var(--luxe-white); overflow: hidden; }

    /* HERO */
    .luxe-hero { position: relative; height: 100vh; min-height: 620px; display: flex; align-items: center; justify-content: center; }
    .luxe-hero-media { position: absolute; inset: 0; }
    .luxe-hero-media img { width: 100%; height: 100%; object-fit: cover; }
    .luxe-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55)); }
    .luxe-hero-content { position: relative; z-index: 2; text-align: center; color: var(--luxe-white); max-width: 900px; padding: 100px 24px 0; }
    .luxe-hero-tag { font-size: 0.8rem; letter-spacing: 7px; font-weight: 500; color: var(--luxe-gold); text-transform: uppercase; }
    .luxe-hero-title { font-family: var(--font-heading); font-size: clamp(3.4rem, 9vw, 6.5rem); font-weight: 500; line-height: 1.05; margin: 26px 0; text-shadow: 0 6px 30px rgba(0,0,0,0.4); }
    .luxe-hero-title em { font-style: italic; color: var(--luxe-gold); }
    .luxe-hero-sub { font-size: clamp(1rem, 2vw, 1.25rem); font-weight: 300; max-width: 600px; margin: 0 auto 45px; line-height: 1.8; font-family: var(--font-body); opacity: 0.95; }
    .luxe-hero-cta { display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap; }
    .hero-btn {
      display: inline-flex; align-items: center; justify-content: center;
      height: 54px; padding: 0 36px; border-radius: 999px;
      background: var(--luxe-gold); color: var(--luxe-black);
      text-decoration: none; font-size: 0.78rem; letter-spacing: 2.2px;
      text-transform: uppercase; font-weight: 600;
      box-shadow: 0 10px 28px rgba(0,0,0,0.22);
      transition: background 0.25s ease, transform 0.25s ease;
    }
    .hero-btn:hover { background: var(--luxe-white); transform: translateY(-2px); }
    .luxe-hero-link { color: var(--luxe-white); text-decoration: none; font-size: 0.8rem; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--luxe-gold); padding-bottom: 6px; transition: color 0.3s ease; }
    .luxe-hero-link:hover { color: var(--luxe-gold); }

    .luxe-trust {
      position: relative; z-index: 3;
      margin-top: 0; padding: 48px 0 28px;
      background: #f7f3eb;
    }
    .trust-kicker {
      text-align: center; margin: 0 0 22px;
      color: var(--luxe-gold); font-size: 0.78rem;
      letter-spacing: 2.4px; text-transform: uppercase; font-weight: 600;
    }
    .trust-grid {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }
    .trust-card {
      background: var(--luxe-white);
      border: 1px solid var(--luxe-border);
      border-radius: 18px;
      padding: 26px 22px 24px;
      min-width: 0;
      box-shadow: 0 12px 32px rgba(20, 16, 10, 0.06);
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .trust-card:hover {
      transform: translateY(-4px);
      border-color: rgba(198, 160, 74, 0.45);
      box-shadow: 0 16px 36px rgba(20, 16, 10, 0.1);
    }
    .trust-ico {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: #f6f1e6; color: var(--luxe-gold); margin-bottom: 16px;
    }
    .trust-ico mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .trust-card h3 {
      margin: 0 0 8px; font-size: 1.02rem; font-weight: 600;
      color: var(--luxe-black); letter-spacing: 0; line-height: 1.3;
    }
    .trust-card p {
      margin: 0; font-size: 0.86rem; font-weight: 300;
      color: var(--luxe-text-muted); line-height: 1.5;
    }

    /* Sections communes */
    .container { max-width: 1440px; margin: 0 auto; padding: 0 40px; }
    .luxe-sec-head { text-align: center; margin-bottom: 60px; }
    .luxe-sec-eyebrow { font-size: 0.75rem; letter-spacing: 5px; text-transform: uppercase; color: var(--luxe-gold); font-weight: 600; }
    .luxe-sec-title { font-family: var(--font-heading); font-size: clamp(2rem, 4vw, 2.8rem); color: var(--luxe-black); margin: 18px 0 0; font-weight: 500; }
    .luxe-sec-line { width: 46px; height: 2px; background: var(--luxe-gold); margin: 24px auto 0; border-radius: 2px; }

    /* Catégories */
    .luxe-categories { padding: 80px 40px 40px; }
    .luxe-cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 26px; }
    .luxe-cat-tile { position: relative; aspect-ratio: 4 / 5; overflow: hidden; border-radius: var(--radius-lg); text-decoration: none; display: block; }
    .luxe-cat-tile img { width: 100%; height: 100%; object-fit: cover; transition: transform 1s ease; }
    .luxe-cat-tile:hover img { transform: scale(1.06); }
    .luxe-cat-shade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,10,10,0.75), rgba(10,10,10,0.05)); }
    .luxe-cat-info { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px; display: flex; flex-direction: column; gap: 6px; }
    .luxe-cat-name { color: var(--luxe-white); font-family: var(--font-heading); font-size: 1.35rem; }
    .luxe-cat-link { color: var(--luxe-gold); font-size: 0.72rem; letter-spacing: 2px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; opacity: 0.9; transition: opacity 0.3s ease; }
    .luxe-cat-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .luxe-cat-tile:hover .luxe-cat-link { opacity: 1; }

    /* Produits vedettes */
    .luxe-featured { padding: 110px 0 60px; }
    .luxe-prod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 34px; }
    .luxe-see-all { text-align: center; margin-top: 60px; }
    .luxe-see-all button { padding: 0 40px; height: 52px; letter-spacing: 2px; }

    /* Atelier */
    .luxe-atelier { background: var(--luxe-black); color: var(--luxe-white); margin-top: 110px; overflow: hidden; }
    .luxe-atelier-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .luxe-atelier-media { min-height: 560px; }
    .luxe-atelier-media img { width: 100%; height: 100%; object-fit: cover; opacity: 0.92; }
    .luxe-atelier-body { padding: clamp(50px, 8vw, 110px); display: flex; flex-direction: column; justify-content: center; }
    .luxe-atelier-title { font-family: var(--font-heading); font-size: clamp(2.4rem, 5vw, 3.6rem); color: var(--luxe-white); margin: 22px 0 30px; font-weight: 500; }
    .luxe-atelier-body p { color: #bbbbbb; font-size: 1.05rem; line-height: 1.9; font-weight: 300; font-family: var(--font-body); }
    .luxe-atelier-list { list-style: none; padding: 0; margin: 34px 0 44px; display: flex; flex-direction: column; gap: 14px; }
    .luxe-atelier-list li { display: flex; align-items: center; gap: 12px; color: #cccccc; font-size: 0.95rem; font-weight: 300; }
    .luxe-atelier-list mat-icon { color: var(--luxe-gold); font-size: 20px; width: 20px; height: 20px; }
    .luxe-text-link { color: var(--luxe-gold); letter-spacing: 2px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 10px; }
    .luxe-text-link:hover { color: var(--luxe-white); }

    .luxe-voices { padding: 90px 0 0; background: var(--luxe-white); }
    .voices-score { margin: 16px 0 0; color: var(--luxe-text-muted); font-size: 0.88rem; }
    .voices-grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }
    .voice-card {
      background: var(--luxe-white); border: 1px solid var(--luxe-border);
      border-radius: 18px; padding: 26px 24px 22px;
      display: flex; flex-direction: column; gap: 16px; min-width: 0;
    }
    .voice-card p {
      margin: 0; color: var(--luxe-charcoal); font-weight: 300; line-height: 1.7;
      font-size: 0.98rem; flex: 1;
    }
    .voice-who { display: flex; align-items: center; gap: 12px; }
    .voice-avatar {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: var(--luxe-black); color: var(--luxe-gold);
      display: flex; align-items: center; justify-content: center; font-weight: 700;
    }
    .voice-who strong { display: block; font-size: 0.9rem; color: var(--luxe-black); }
    .voice-who small { display: block; font-size: 0.75rem; color: var(--luxe-text-muted); }
    .voices-cta { text-align: center; padding: 40px 0 72px; }
    .voice-link {
      display: inline-flex; align-items: center; gap: 10px;
      background: none; border: none; cursor: pointer;
      font-family: var(--font-body); font-size: 0.78rem; letter-spacing: 2px;
      text-transform: uppercase; color: var(--luxe-gold); padding: 0 0 6px;
      border-bottom: 1px solid var(--luxe-gold);
    }
    .voice-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .voice-link:hover { color: var(--luxe-black); border-bottom-color: var(--luxe-black); }
    .luxe-stars { display: flex; gap: 3px; }
    .luxe-stars mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }

    @media (max-width: 960px) {
      .container, .luxe-categories { padding-left: 20px; padding-right: 20px; }
      .luxe-trust { padding-top: 32px; }
      .trust-grid { grid-template-columns: 1fr 1fr; }
      .voices-grid { grid-template-columns: 1fr; }
      .luxe-atelier-grid { grid-template-columns: 1fr; }
      .luxe-atelier-media { min-height: 340px; }
      .luxe-atelier-body { padding: 50px 26px; }
      .luxe-prod-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    }
    @media (max-width: 560px) {
      .trust-grid { grid-template-columns: 1fr; }
      .luxe-prod-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    }
  `]
})
export class HomeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  products: any[] = [];
  categories: any[] = [];
  heroImage = DEFAULT_HERO_IMAGE;
  homeReviews: any[] = [];
  reviewCount = 0;
  reviewAverage = 0;
  shopReviewDone = false;
  readonly fallbackReviews = [{
    comment: 'J’ai enfin trouvé des soins qui respectent ma peau tout en m’offrant un vrai moment de luxe. Le rituel Nelya est devenu mon moment préféré.',
    author: 'Sarah B.',
    authorInitial: 'S',
    product_name: 'Cliente fidèle',
    rating: 5
  }];

  get displayReviews(): any[] {
    return this.homeReviews.length ? this.homeReviews.slice(0, 3) : this.fallbackReviews;
  }

  constructor(
    private crud: CrudService,
    private catalog: CatalogService,
    private snackBar: MatSnackBar,
    public brand: BrandService,
    private settings: SettingsService,
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.heroImage = this.settings.heroImage;
    this.settings.heroImage$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((url) => { this.heroImage = url; });

    this.crud.getPage<any>('products', { limit: 8, sort: 'newest:desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => { this.products = page.data; },
        error: () => {}
      });

    this.catalog.getMeta().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (meta) => {
        this.categories = (meta.categories || [])
          .filter((c: CategoryCount) => c.name !== 'Promotions')
          .slice(0, 4);
      },
      error: () => {}
    });

    this.loadReviews();
  }

  openShopReview() {
    if (!this.auth.isLoggedIn) {
      this.snackBar.open('Connectez-vous pour laisser un témoignage.', 'Connexion', { duration: 4000 })
        .onAction().subscribe(() => this.router.navigate(['/auth/login']));
      return;
    }
    if (this.shopReviewDone) {
      this.snackBar.open('Vous avez déjà publié un témoignage.', 'Fermer', { duration: 3500 });
      return;
    }
    void import('../products/review-dialog.component').then(({ ReviewDialogComponent }) => {
      const ref = this.dialog.open(ReviewDialogComponent, { width: '520px', panelClass: 'luxury-dialog' });
      ref.componentInstance.productName = 'Votre témoignage Nelya';
      ref.afterClosed().subscribe((result) => {
        if (!result) return;
        this.api.post('reviews', { rating: result.rating, comment: result.comment }).subscribe({
          next: () => {
            this.snackBar.open('Merci, votre témoignage est publié.', 'Fermer', { duration: 3500 });
            this.loadReviews();
          },
          error: (err) => this.snackBar.open(err?.error?.message || 'Impossible de publier le témoignage', 'Fermer', { duration: 4000 })
        });
      });
    });
  }

  trackById(_index: number, item: { id?: string }): string {
    return item?.id || String(_index);
  }

  trackByName(_index: number, item: { name?: string }): string {
    return item?.name || String(_index);
  }

  trackByReview(_index: number, item: { id?: string; author?: string }): string {
    return item?.id || item?.author || String(_index);
  }

  private loadReviews() {
    this.api.get<any>('reviews', { limit: 12 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.homeReviews = page.data || [];
        this.reviewCount = Number(page.count || 0);
        this.reviewAverage = Number(page.average || 0);
        this.shopReviewDone = Boolean(page.shopMine);
      },
      error: () => {}
    });
  }

}
