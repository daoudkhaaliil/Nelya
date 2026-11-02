import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, takeUntil, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { CrudService } from '../../services/crud.service';
import { CategoryCount } from '../../services/catalog.types';
import { CatalogService } from '../../services/catalog.service';

// Correspondance entre les valeurs du menu de tri et le paramètre attendu par l'API.
const SORT_PARAMS: Record<string, string> = {
  'featured': '',
  'price-asc': 'price:asc',
  'price-desc': 'price:desc',
  'name-asc': 'name:asc'
};
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BreadcrumbComponent, Crumb } from '../../components/breadcrumb/breadcrumb.component';
import { FormatCurrencyPipe } from '../../pipes/format-currency.pipe';
import { BrandService } from '../../services/brand.service';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatSliderModule, FormsModule, ProductCardComponent, BreadcrumbComponent, FormatCurrencyPipe],
  template: `
    <div class="collection-page">
      <header class="collection-hero">
        <div class="container">
          <app-breadcrumb [crumbs]="breadcrumbs"></app-breadcrumb>
          <span class="collection-eyebrow">COLLECTION {{ brand.name | uppercase }}</span>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageSubtitle }}</p>
        </div>
      </header>

      <div class="collection-layout container">
        <!-- SIDEBAR -->
        <aside class="filter-sidebar" [class.open]="filtersOpen">
          <div class="filter-head">
            <h3>FILTRES</h3>
            <button class="filter-close" (click)="filtersOpen = false" aria-label="Fermer les filtres">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="filter-group">
            <h4 class="filter-title">Catégories</h4>
            <button type="button" class="filter-link" [class.active]="selectedCategory === 'all'" (click)="selectCategory('all')">
              Tout voir
            </button>
            <div class="filter-cat" *ngFor="let cat of categories">
              <button type="button" class="filter-link" [class.active]="isParentSelected(cat.name)" (click)="selectCategory(cat.name)">
                <span>{{ cat.name }}</span>
                <span class="filter-count">{{ cat.count }}</span>
              </button>
              <div class="filter-subs" *ngIf="cat.children?.length">
                <button type="button" class="filter-sub" *ngFor="let sub of cat.children"
                  [class.active]="selectedSub === sub.name"
                  (click)="selectSub(cat.name, sub.name)">
                  <span>{{ sub.name }}</span>
                  <span class="filter-count">{{ sub.count }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="filter-group">
            <h4 class="filter-title">Prix maximum &mdash; {{maxPriceDisplay | formatCurrency:0}}</h4>
            <mat-slider [min]="priceMin" [max]="priceMax" step="5" discrete [discrete]="true">
              <input matSliderThumb [(ngModel)]="maxPriceDisplay" (ngModelChange)="onPriceChange()">
            </mat-slider>
            <div class="filter-range">
              <span>{{ priceMin | formatCurrency:0 }}</span>
              <span>{{ priceMax | formatCurrency:0 }}</span>
            </div>
          </div>

          <div class="filter-promo">
            <h4>ÉDITION LIMITÉE</h4>
            <p>La sélection d'exception Nelya.</p>
            <button mat-stroked-button (click)="goTo('Promotions')">DÉCOUVRIR</button>
          </div>
        </aside>
        <div class="filter-scrim" *ngIf="filtersOpen" (click)="filtersOpen = false"></div>

        <!-- RESULTS -->
        <main class="results">
          <div class="results-toolbar">
            <p class="results-count" *ngIf="!loading">
              <strong>{{ total }}</strong> produit{{ total > 1 ? 's' : '' }}
            </p>
            <div class="toolbar-actions">
              <button class="mobile-filters-btn" (click)="filtersOpen = true">
                <mat-icon>tune</mat-icon> FILTRES <span class="filter-dot" *ngIf="activeFilterCount"></span>
              </button>
              <div class="sort-wrap">
                <label for="sortSelect">Trier</label>
                <select id="sortSelect" [(ngModel)]="sortBy" (ngModelChange)="reload()" aria-label="Trier les produits">
                  <option value="featured">Recommandés</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                  <option value="name-asc">Nom (A &rarr; Z)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Skeletons -->
          <div class="products-grid" *ngIf="loading">
            <div class="pcard-skeleton" *ngFor="let _ of [1,2,3,4,5,6]">
              <div class="skeleton skeleton-media"></div>
              <div class="skeleton skeleton-line" style="width:40%"></div>
              <div class="skeleton skeleton-line" style="width:70%"></div>
              <div class="skeleton skeleton-line" style="width:50%"></div>
            </div>
          </div>

          <!-- Empty -->
          <div class="results-empty" *ngIf="!loading && products.length === 0 && !loadError">
            <mat-icon>search_off</mat-icon>
            <h3>Aucun produit trouvé</h3>
            <p>Essayez d'élargir vos critères de recherche ou de réinitialiser les filtres.</p>
            <button mat-flat-button color="primary" (click)="resetFilters()">RÉINITIALISER LES FILTRES</button>
          </div>

          <!-- Erreur réseau : distinguée du « aucun résultat », qui ne veut pas dire la même chose -->
          <div class="results-empty" *ngIf="!loading && loadError">
            <mat-icon>cloud_off</mat-icon>
            <h3>Chargement impossible</h3>
            <p>La boutique n'a pas pu être contactée. Vérifiez votre connexion.</p>
            <button mat-flat-button color="primary" (click)="reload()">RÉESSAYER</button>
          </div>

          <!-- Grid -->
          <div class="products-grid" *ngIf="!loading && products.length">
            <app-product-card *ngFor="let product of products; trackBy: trackById" [product]="product"></app-product-card>
          </div>

          <div class="see-more" *ngIf="!loading && products.length < total">
            <p>{{ products.length }} sur {{ total }} produits</p>
            <button mat-stroked-button (click)="showMore()" [disabled]="loadingMore">
              {{ loadingMore ? 'CHARGEMENT…' : 'VOIR PLUS DE PRODUITS' }}
            </button>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .collection-page { min-height: 80vh; }

    .collection-hero { padding: 130px 0 50px; background: var(--luxe-offwhite); border-bottom: 1px solid var(--luxe-border); }
    .collection-hero .container { padding-top: 10px; }
    .collection-eyebrow { display: block; font-size: 0.72rem; letter-spacing: 5px; color: var(--luxe-gold); font-weight: 600; text-transform: uppercase; margin: 18px 0 12px; }
    .collection-hero h1 { font-family: var(--font-heading); font-size: clamp(2.4rem, 5vw, 3.6rem); color: var(--luxe-black); margin: 0; font-weight: 500; }
    .collection-hero p { color: var(--luxe-text-muted); font-weight: 300; margin-top: 12px; }

    .collection-layout { display: grid; grid-template-columns: 280px 1fr; gap: 70px; padding: 60px 0 40px; align-items: start; }

    /* Sidebar */
    .filter-sidebar { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 10px; }
    .filter-head { display: none; }
    .filter-group { padding: 26px 0; border-bottom: 1px solid var(--luxe-border); }
    .filter-title { font-family: var(--font-heading); font-size: 1.15rem; margin: 0 0 20px; color: var(--luxe-charcoal); font-weight: 500; }
    .filter-cat { margin-bottom: 10px; }
    .filter-link, .filter-sub {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; background: none; border: none; padding: 7px 0; cursor: pointer;
      font-family: var(--font-body); font-size: 0.92rem; color: var(--luxe-charcoal); text-align: left;
    }
    .filter-link.active, .filter-sub.active { color: var(--luxe-gold); font-weight: 600; }
    .filter-subs { padding: 2px 0 6px 16px; border-left: 1px solid var(--luxe-border); margin: 2px 0 8px 4px; }
    .filter-sub { font-size: 0.86rem; color: var(--luxe-text-muted); }
    .filter-count { font-size: 0.75rem; color: var(--luxe-text-muted); font-weight: 500; }
    .filter-range { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--luxe-text-muted); margin-top: 8px; }
    .filter-promo {
      margin-top: 20px; padding: 34px 24px; text-align: center; border-radius: var(--radius-lg);
      color: var(--luxe-white); background: var(--luxe-black);
      background-image: linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.7)), url('https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?auto=format&fit=crop&q=80&w=500');
      background-size: cover; background-position: center;
    }
    .filter-promo h4 { font-size: 0.72rem; letter-spacing: 3px; color: var(--luxe-gold); margin-bottom: 12px; font-weight: 600; }
    .filter-promo p { font-family: var(--font-heading); font-size: 1.15rem; margin-bottom: 22px; line-height: 1.4; }
    .filter-promo button { border-color: var(--luxe-white); color: var(--luxe-white); font-size: 0.7rem; letter-spacing: 2px; }
    .filter-promo button:hover { background: var(--luxe-gold); border-color: var(--luxe-gold); color: var(--luxe-black); }

    /* Toolbar */
    .results-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 34px; flex-wrap: wrap; }
    .results-count { color: var(--luxe-text-muted); font-weight: 300; margin: 0; font-size: 0.9rem; }
    .results-count strong { color: var(--luxe-black); font-weight: 600; }
    .toolbar-actions { display: flex; align-items: center; gap: 18px; }
    .mobile-filters-btn {
      display: none; align-items: center; gap: 8px;
      background: none; border: 1px solid var(--luxe-border); border-radius: var(--radius-pill);
      padding: 10px 18px; font-size: 0.72rem; letter-spacing: 2px; font-weight: 600; cursor: pointer;
      color: var(--luxe-charcoal); position: relative;
    }
    .filter-dot { position: absolute; top: 6px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--luxe-gold); }
    .sort-wrap { display: flex; align-items: center; gap: 10px; }
    .sort-wrap label { font-size: 0.72rem; letter-spacing: 2px; text-transform: uppercase; color: var(--luxe-text-muted); font-weight: 600; }
    .sort-wrap select {
      padding: 10px 14px; border: 1px solid var(--luxe-border); border-radius: var(--radius-sm);
      background: var(--luxe-white); color: var(--luxe-charcoal); font-family: var(--font-body);
      font-size: 0.85rem; outline: none; cursor: pointer; transition: border-color 0.3s ease;
    }
    .sort-wrap select:focus { border-color: var(--luxe-gold); }

    /* Grid */
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 34px; }
    .pcard-skeleton { display: flex; flex-direction: column; gap: 12px; }
    .skeleton-media { aspect-ratio: 4 / 5; border-radius: var(--radius-lg); }

    /* Empty */
    .results-empty { text-align: center; padding: 90px 20px; }
    .results-empty mat-icon { font-size: 60px; width: 60px; height: 60px; color: var(--luxe-gold); }
    .results-empty h3 { font-family: var(--font-heading); color: var(--luxe-black); margin: 18px 0 8px; font-size: 1.4rem; }
    .results-empty p { color: var(--luxe-text-muted); margin-bottom: 28px; font-weight: 300; }

    /* See more */
    .see-more { text-align: center; margin-top: 56px; }
    .see-more p { color: var(--luxe-text-muted); font-size: 0.85rem; margin-bottom: 16px; }
    .see-more button { padding: 0 40px; height: 52px; letter-spacing: 2px; }

    .filter-scrim { display: none; }

    .container { max-width: 1440px; margin: 0 auto; padding: 0 40px; }

    @media (max-width: 960px) {
      .collection-hero { padding: 110px 0 40px; }
      .collection-layout { grid-template-columns: 1fr; gap: 0; padding: 34px 0 30px; }
      .container { padding: 0 20px; }
      .mobile-filters-btn { display: inline-flex; }
      .toolbar-actions { justify-content: space-between; width: 100%; }
      .filter-sidebar {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 1100; width: min(340px, 86vw);
        background: var(--luxe-white); padding: 24px; overflow-y: auto;
        box-shadow: var(--shadow-modal); transform: translateX(100%); transition: transform 0.35s ease;
        display: flex; flex-direction: column; gap: 0;
      }
      .filter-sidebar.open { transform: translateX(0); }
      .filter-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--luxe-border); padding-bottom: 18px; }
      .filter-head h3 { font-family: var(--font-heading); margin: 0; color: var(--luxe-black); letter-spacing: 2px; }
      .filter-close { background: none; border: none; cursor: pointer; color: var(--luxe-charcoal); display: flex; }
      .filter-scrim { display: block; position: fixed; inset: 0; background: rgba(10,10,10,0.45); z-index: 1050; }
      .products-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    }
    @media (max-width: 480px) {
      .products-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    }
  `]
})
export class CollectionComponent implements OnInit, OnDestroy {
  /** Produits chargés jusqu'ici, pas le catalogue entier. */
  products: any[] = [];
  categories: CategoryCount[] = [];
  total = 0;
  selectedCategory: string = 'all';
  selectedSub: string = '';
  searchTerm: string = '';
  sortBy: string = 'featured';
  priceMin: number = 0;
  priceMax: number = 200;
  maxPriceDisplay: number = 200;
  loading = true;
  loadingMore = false;
  loadError = false;
  filtersOpen = false;

  private pageSize = 12;
  private currentPage = 1;
  private pageCount = 1;

  // Le curseur de prix émet à chaque pixel de déplacement : sans ce tampon, une seule
  // glissade déclencherait des dizaines de requêtes.
  private priceChange$ = new Subject<void>();
  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private crud: CrudService,
    private catalog: CatalogService,
    public brand: BrandService
  ) {}

  get pageTitle(): string {
    if (this.selectedSub) return this.selectedSub;
    return this.selectedCategory === 'all' ? 'La Boutique' : this.selectedCategory;
  }

  get pageSubtitle(): string {
    if (this.selectedSub) {
      return `Notre sélection ${this.selectedCategory} · ${this.selectedSub}.`;
    }
    return this.selectedCategory === 'all'
      ? 'Explorez notre gamme complète de soins d\'exception.'
      : `Notre sélection dans la catégorie ${this.selectedCategory}.`;
  }

  get breadcrumbs() {
    const crumbs: Crumb[] = [{ label: 'Boutique', url: '/collection' }];
    if (this.selectedCategory !== 'all') {
      crumbs.push({
        label: this.selectedCategory,
        url: this.selectedSub ? '/collection' : undefined,
        queryParams: this.selectedSub ? { cat: this.selectedCategory } : undefined
      });
    }
    if (this.selectedSub) crumbs.push({ label: this.selectedSub });
    return crumbs;
  }

  get activeFilterCount(): number {
    let n = 0;
    if (this.selectedCategory !== 'all') n++;
    if (this.selectedSub) n++;
    if (this.maxPriceDisplay < this.priceMax) n++;
    if (this.searchTerm) n++;
    return n;
  }

  trackById(_index: number, product: any) {
    return product.id;
  }

  ngOnInit() {
    this.loadMeta();

    this.priceChange$
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());

    // switchMap annule la requête précédente : un filtre changé deux fois de suite ne
    // peut pas voir l'ancienne réponse écraser la nouvelle.
    this.reload$
      .pipe(
        tap(() => { this.loading = true; this.loadError = false; }),
        switchMap(() => this.crud.getPage<any>('products', this.buildQuery(1))),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: page => {
          this.products = page.data;
          this.total = page.total;
          this.currentPage = page.page;
          this.pageCount = page.pages;
          this.loading = false;
        },
        error: () => {
          this.products = [];
          this.total = 0;
          this.loadError = true;
          this.loading = false;
        }
      });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['q'] !== undefined) this.searchTerm = params['q'];
      this.selectedCategory = params['cat'] || 'all';
      this.selectedSub = params['sub'] || '';
      this.reload();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Bornes du curseur de prix et catégories réellement présentes au catalogue. */
  private loadMeta() {
    this.catalog.getMeta().subscribe({
      next: (meta) => {
        this.categories = meta.categories || [];
        this.priceMax = Math.max(10, Math.ceil(Number(meta.maxPrice || 0) / 10) * 10);
        if (this.maxPriceDisplay >= this.priceMax || this.maxPriceDisplay === 200) {
          this.maxPriceDisplay = this.priceMax;
        }
      },
      error: () => { this.categories = []; }
    });
  }

  private buildQuery(page: number) {
    return {
      page,
      limit: this.pageSize,
      search: this.searchTerm.trim() || undefined,
      category: this.selectedCategory === 'all' ? undefined : this.selectedCategory,
      subcategory: this.selectedSub || undefined,
      // Au plafond, aucun filtre de prix n'est envoyé : inutile de restreindre
      // avec une borne égale au prix le plus élevé du catalogue.
      price_max: this.maxPriceDisplay < this.priceMax ? this.maxPriceDisplay : undefined,
      sort: SORT_PARAMS[this.sortBy] || undefined
    };
  }

  reload() {
    this.reload$.next();
  }

  onPriceChange() {
    this.priceChange$.next();
  }

  isParentSelected(name: string): boolean {
    return this.selectedCategory === name && !this.selectedSub;
  }

  selectCategory(cat: string) {
    this.filtersOpen = false;
    this.router.navigate(['/collection'], {
      queryParams: cat === 'all' ? {} : { cat }
    });
  }

  selectSub(cat: string, sub: string) {
    this.filtersOpen = false;
    this.router.navigate(['/collection'], { queryParams: { cat, sub } });
  }

  onCategoryChange(cat: string) {
    this.selectCategory(cat || 'all');
  }

  showMore() {
    if (this.loadingMore || this.currentPage >= this.pageCount) return;
    this.loadingMore = true;
    this.crud.getPage<any>('products', this.buildQuery(this.currentPage + 1)).subscribe({
      next: page => {
        this.products = [...this.products, ...page.data];
        this.total = page.total;
        this.currentPage = page.page;
        this.pageCount = page.pages;
        this.loadingMore = false;
      },
      error: () => { this.loadingMore = false; }
    });
  }

  resetFilters() {
    this.selectedCategory = 'all';
    this.selectedSub = '';
    this.searchTerm = '';
    this.maxPriceDisplay = this.priceMax;
    this.sortBy = 'featured';
    this.router.navigate(['/collection']);
    this.reload();
  }

  goTo(cat: string) {
    this.router.navigate(['/collection'], { queryParams: { cat } });
  }
}
