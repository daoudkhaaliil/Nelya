import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, takeUntil, tap } from 'rxjs';
import { CrudService } from '../../services/crud.service';
import { ApiService } from '../../services/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';
import { FormatCurrencyPipe } from '../../pipes/format-currency.pipe';
import { PaginationComponent } from '../../components/pagination/pagination.component';
import { ConfirmService } from '../../services/confirm.service';
import { compressImageFile, imageUploadErrorMessage } from '../../utils/image-compress';

interface StockSummary {
  skuCount: number;
  units: number;
  outOfStock: number;
  lowStock: number;
  lowThreshold: number;
}

@Component({
  selector: 'app-products-manager',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule,
    ImageUrlPipe,
    FormatCurrencyPipe,
    PaginationComponent
  ],
  template: `
    <div class="products-page fade-in">
      <div class="page-head">
        <div>
          <h2>Produits</h2>
          <p>Fiches, photos, prix de vente et prix d’achat. Le profit se calcule tout seul sur les ventes.</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/admin/stock" *ngIf="!showForm">
            <mat-icon>warehouse</mat-icon> Gérer le stock
          </a>
          <button mat-stroked-button color="primary" (click)="toggleImport()" *ngIf="!showForm">
            <mat-icon>upload_file</mat-icon> {{ showImport ? 'Fermer' : 'Importer' }}
          </button>
          <button mat-raised-button color="primary" (click)="toggleForm()" *ngIf="!showForm">
            <mat-icon>add</mat-icon> Ajouter un produit
          </button>
          <button mat-raised-button color="accent" (click)="toggleForm()" *ngIf="showForm">
            <mat-icon>close</mat-icon> Annuler
          </button>
        </div>
      </div>

      <div class="kpis" *ngIf="!showForm">
        <div class="kpi">
          <span class="kpi-label">Articles</span>
          <span class="kpi-value">{{ summary.skuCount }}</span>
        </div>
        <div class="kpi mute">
          <span class="kpi-label">Catégories</span>
          <span class="kpi-value">{{ categories.length }}</span>
        </div>
        <div class="kpi danger">
          <span class="kpi-label">Rupture</span>
          <span class="kpi-value">{{ summary.outOfStock }}</span>
        </div>
        <div class="kpi warn">
          <span class="kpi-label">Stock faible</span>
          <span class="kpi-value">{{ summary.lowStock }}</span>
        </div>
      </div>

      <mat-card class="form-card" *ngIf="showImport && !showForm">
        <mat-card-header>
          <mat-card-title>Importer un catalogue</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="import-help">
            Colonnes :
            <code>Ref</code>, <code>Catégorie</code>, <code>Désignation</code>,
            <code>Contenance</code>, <code>Prix</code>, <code>PrixAchat</code>, <code>Image</code>,
            <code>Image2</code>… (<code>Stock</code> et <code>Description</code> facultatives).
            CSV, Excel (<code>.xlsx</code>) ou ZIP. Première feuille du classeur.
          </p>
          <ul class="import-rules">
            <li>Un CSV ou un Excel ne peut pas contenir les photos elles-mêmes : seulement un nom de fichier ou un lien.</li>
            <li>Pour envoyer les photos : zippez le CSV/Excel avec les fichiers, et mettez les noms dans <strong>Image</strong>, <strong>Image2</strong>… (ex. <code>deodorant.jpg</code>). Plusieurs noms dans une cellule, séparés par <code>|</code>.</li>
            <li>Les catégories absentes sont créées. Une Ref déjà connue met le produit à jour.</li>
          </ul>

          <div class="import-actions">
            <mat-form-field appearance="outline" class="stock-field">
              <mat-label>Stock par défaut</mat-label>
              <input matInput type="number" min="0" [(ngModel)]="defaultStock" [ngModelOptions]="{ standalone: true }">
              <mat-hint>Si la colonne Stock est vide</mat-hint>
            </mat-form-field>

            <input type="file" hidden #csvInput accept=".csv,.txt,.zip,.xlsx,.xls,text/csv,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" (change)="onCsvSelected($event)">
            <button mat-flat-button color="primary" [disabled]="importing" (click)="csvInput.click()">
              <mat-icon>upload_file</mat-icon>
              {{ importing ? 'Import en cours…' : 'Choisir CSV, Excel ou ZIP' }}
            </button>
            <mat-spinner *ngIf="importing" diameter="24"></mat-spinner>
            <button mat-stroked-button (click)="downloadTemplate()">
              <mat-icon>download</mat-icon> Modèle CSV
            </button>
          </div>
          <p class="import-file" *ngIf="importFileName">Fichier : {{ importFileName }}</p>

          <div class="import-report" *ngIf="importReport">
            <p class="report-summary">
              <strong>{{ importReport.created }}</strong> créé(s) ·
              <strong>{{ importReport.updated }}</strong> mis à jour ·
              <strong>{{ importReport.skipped }}</strong> ignoré(s)
              sur {{ importReport.total }} ligne(s)
              <ng-container *ngIf="importReport.imagesImported">
                · <strong>{{ importReport.imagesImported }}</strong> photo(s) extraite(s) du ZIP
              </ng-container>
            </p>
            <p *ngIf="importReport.categoriesCreated?.length">
              Catégories créées : {{ importReport.categoriesCreated.join(', ') }}
            </p>
            <div class="report-errors" *ngIf="importReport.errors?.length">
              <p>Lignes ignorées :</p>
              <ul>
                <li *ngFor="let e of importReport.errors">Ligne {{ e.line }} — {{ e.message }}</li>
              </ul>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="form-card" *ngIf="showForm">
        <mat-card-header>
          <mat-card-title>{{ isEditMode ? 'Modifier le produit' : 'Nouveau produit' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="productForm" (ngSubmit)="saveProduct()">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Référence</mat-label>
                <input matInput formControlName="reference" placeholder="ex: NEL-001">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nom du produit</mat-label>
                <input matInput formControlName="name" placeholder="ex: Crème de Nuit">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Contenance</mat-label>
                <input matInput formControlName="contenance" placeholder="ex: 50 ml">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Catégorie</mat-label>
                <mat-select formControlName="category" (selectionChange)="onParentCategoryChange()">
                  <mat-option *ngFor="let c of parentCategories" [value]="c.name">{{ c.name }}</mat-option>
                </mat-select>
                <mat-hint *ngIf="categories.length === 0">
                  Aucune catégorie — <a routerLink="/admin/categories">créez-en une</a>
                </mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" *ngIf="subsForSelectedParent().length">
                <mat-label>Sous-catégorie</mat-label>
                <mat-select formControlName="subcategory">
                  <mat-option [value]="''">Aucune</mat-option>
                  <mat-option *ngFor="let s of subsForSelectedParent()" [value]="s.name">{{ s.name }}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Prix de vente</mat-label>
                <input matInput type="number" min="0" step="0.01" formControlName="price" placeholder="ex: 25.00">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Prix d’achat</mat-label>
                <input matInput type="number" min="0" step="0.01" formControlName="cost_price" placeholder="ex: 12.00">
                <mat-hint>Coût fournisseur — sert au calcul du profit</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Stock</mat-label>
                <input matInput type="number" formControlName="stock" placeholder="ex: 50">
              </mat-form-field>
            </div>

            <div class="image-field full-width">
              <span class="image-label">Photos du produit</span>
              <p class="image-hint">Au moins une photo. La première est la couverture (liste, accueil, panier). Jusqu’à 8.</p>
              <div class="gallery-edit" *ngIf="galleryImages.length">
                <div class="gallery-tile" *ngFor="let img of galleryImages; let i = index">
                  <img [src]="img | imageUrl" [alt]="'Photo ' + (i + 1)">
                  <span class="cover-tag" *ngIf="i === 0">Couverture</span>
                  <div class="tile-actions">
                    <button type="button" mat-icon-button [disabled]="i === 0" (click)="moveImage(i, -1)" matTooltip="Vers la gauche">
                      <mat-icon>chevron_left</mat-icon>
                    </button>
                    <button type="button" mat-icon-button [disabled]="i === galleryImages.length - 1" (click)="moveImage(i, 1)" matTooltip="Vers la droite">
                      <mat-icon>chevron_right</mat-icon>
                    </button>
                    <button type="button" mat-icon-button color="warn" (click)="removeImage(i)" matTooltip="Retirer">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
              <div class="image-actions">
                <input type="file" hidden #fileInput accept="image/*" multiple (change)="onFileSelected($event)">
                <button type="button" mat-stroked-button color="primary" [disabled]="uploading || galleryImages.length >= 8" (click)="fileInput.click()">
                  <mat-icon>add_photo_alternate</mat-icon>
                  {{ uploading ? 'Envoi en cours…' : 'Ajouter des photos' }}
                </button>
                <mat-spinner *ngIf="uploading" diameter="20"></mat-spinner>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <textarea matInput formControlName="description" rows="4"></textarea>
            </mat-form-field>

            <div class="form-actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="productForm.invalid || !galleryImages.length">
                <mat-icon>save</mat-icon> Enregistrer
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="table-wrap" *ngIf="!showForm">
        <div class="toolbar">
          <mat-form-field appearance="outline" class="search">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Rechercher</mat-label>
            <input matInput [(ngModel)]="searchTerm" (ngModelChange)="resetPage()" placeholder="Nom, référence…">
          </mat-form-field>
          <mat-form-field appearance="outline" class="cat">
            <mat-label>Catégorie</mat-label>
            <mat-select [(ngModel)]="categoryFilter" (ngModelChange)="resetPage()">
              <mat-option value="all">Toutes</mat-option>
              <ng-container *ngFor="let c of parentCategories">
                <mat-option [value]="c.name">{{ c.name }}</mat-option>
                <mat-option *ngFor="let s of childrenOfParent(c.id)" [value]="'sub:' + s.name"> — {{ s.name }}</mat-option>
              </ng-container>
            </mat-select>
          </mat-form-field>
          <span class="result-count">{{ total }} produit{{ total > 1 ? 's' : '' }}</span>
        </div>

        <div class="rows" *ngIf="products.length; else empty">
          <div class="row head">
            <span></span>
            <span>Produit</span>
            <span>Vente / Achat</span>
            <span>Stock</span>
            <span></span>
          </div>
          <div class="row" *ngFor="let p of products">
            <div class="thumb-wrap">
              <img [src]="p.image_url | imageUrl" [alt]="p.name" class="thumb">
              <span class="more-photos" *ngIf="photoCount(p) > 1">+{{ photoCount(p) - 1 }}</span>
            </div>
            <div class="meta">
              <strong>{{ p.name }}</strong>
              <span>{{ p.reference || 'Sans réf.' }} · {{ p.category || '—' }}<ng-container *ngIf="p.subcategory"> · {{ p.subcategory }}</ng-container><ng-container *ngIf="p.contenance"> · {{ p.contenance }}</ng-container></span>
            </div>
            <span class="price">
              <strong>{{ p.price | formatCurrency }}</strong>
              <small>Achat {{ (p.cost_price || 0) | formatCurrency }}</small>
              <small class="margin" *ngIf="margin(p) != null">Marge {{ margin(p) | formatCurrency }}</small>
            </span>
            <span class="badge" [ngClass]="statusClass(p.stock)">{{ statusLabel(p.stock) }} · {{ p.stock }}</span>
            <div class="row-actions">
              <button type="button" mat-icon-button color="primary" matTooltip="Modifier" (click)="editProduct(p)">
                <mat-icon>edit</mat-icon>
              </button>
              <button type="button" mat-icon-button color="warn" matTooltip="Supprimer" (click)="deleteProduct(p.id)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <ng-template #empty>
          <div class="empty" *ngIf="!loading">
            <mat-icon>inventory_2</mat-icon>
            <p>Aucun produit ne correspond à votre recherche.</p>
          </div>
        </ng-template>

        <app-pagination [pageIndex]="pageIndex" [pageSize]="pageSize" [totalItems]="total"
          (pageChange)="onPageChange($event)"></app-pagination>
      </div>
    </div>
  `,
  styles: [`
    .products-page { width: 100%; min-width: 0; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
    .page-head h2 { margin: 0 0 6px; font-family: var(--font-heading); font-size: clamp(1.6rem, 3vw, 2rem); font-weight: 500; }
    .page-head p { margin: 0; color: var(--luxe-text-muted); font-weight: 300; font-size: 0.9rem; max-width: 560px; }
    .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
    .kpi {
      text-align: left; padding: 18px 20px; border-radius: 14px; min-width: 0;
      background: var(--luxe-white); border: 1px solid var(--luxe-border);
    }
    .kpi-label { display: block; font-size: 0.75rem; color: var(--luxe-text-muted); letter-spacing: 0.4px; margin-bottom: 6px; }
    .kpi-value { font-family: var(--font-heading); font-size: 1.7rem; color: var(--luxe-black); }
    .kpi.danger .kpi-value { color: #b42318; }
    .kpi.warn .kpi-value { color: #b54708; }

    .form-card { border-radius: 16px; padding: 12px 8px 8px; margin-bottom: 22px; }
    .full-width { width: 100%; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 15px; }
    .image-field { margin-bottom: 15px; }
    .image-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--luxe-text-muted); display: block; margin-bottom: 8px; font-weight: 600; }
    .image-hint { margin: 0 0 12px; font-size: 0.82rem; color: var(--luxe-text-muted); font-weight: 300; }
    .image-actions { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
    .gallery-edit { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
    .gallery-tile { position: relative; width: 96px; }
    .gallery-tile img { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; border: 1px solid var(--luxe-border); display: block; }
    .cover-tag {
      position: absolute; top: 6px; left: 6px; background: var(--luxe-black); color: var(--luxe-gold);
      font-size: 0.62rem; letter-spacing: 0.6px; text-transform: uppercase; padding: 2px 6px; border-radius: 4px;
    }
    .tile-actions { display: flex; justify-content: center; }
    .thumb-wrap { position: relative; width: 52px; height: 64px; }
    .more-photos {
      position: absolute; right: -4px; bottom: -4px; background: var(--luxe-black); color: var(--luxe-white);
      font-size: 0.65rem; padding: 1px 5px; border-radius: 8px;
    }

    .import-help { color: var(--luxe-text-muted); font-size: 0.9rem; line-height: 1.7; }
    .import-help code, .import-rules code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
    .import-rules { color: var(--luxe-text-muted); font-size: 0.85rem; line-height: 1.8; margin: 0 0 18px; padding-left: 20px; }
    .import-actions { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .stock-field { width: 200px; max-width: 100%; }
    .import-file { margin: 8px 0 0; font-size: 0.82rem; color: var(--luxe-text-muted); }
    .import-report { margin-top: 24px; padding: 16px; border-radius: 10px; border: 1px solid var(--luxe-border); }
    .report-summary { margin: 0 0 8px; }
    .report-errors { margin-top: 12px; color: var(--luxe-crimson); font-size: 0.85rem; }
    .report-errors ul { margin: 6px 0 0; padding-left: 20px; line-height: 1.7; }

    .table-wrap {
      min-width: 0; background: var(--luxe-white);
      border: 1px solid var(--luxe-border); border-radius: 16px; overflow: hidden;
    }
    .toolbar {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      padding: 16px 18px 4px;
    }
    .search { flex: 1; min-width: 180px; }
    .cat { width: 200px; max-width: 100%; }
    .result-count { color: var(--luxe-text-muted); font-size: 0.85rem; margin-left: auto; }

    .rows { width: 100%; }
    .row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) 140px 150px 88px;
      gap: 14px;
      align-items: center;
      padding: 10px 18px;
      border-top: 1px solid var(--luxe-border);
    }
    .row.head {
      border-top: none;
      padding-top: 6px;
      padding-bottom: 8px;
      font-size: 0.7rem;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: var(--luxe-text-muted);
      font-weight: 700;
    }
    .thumb { width: 52px; height: 64px; object-fit: cover; border-radius: 8px; background: var(--luxe-offwhite); }
    .meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .meta strong { font-size: 0.95rem; color: var(--luxe-black); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta span { font-size: 0.78rem; color: var(--luxe-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .price { display: flex; flex-direction: column; gap: 2px; font-weight: 600; white-space: nowrap; line-height: 1.25; }
    .price small { font-weight: 400; font-size: 0.72rem; color: var(--luxe-text-muted); }
    .price .margin { color: #067647; }
    .row-actions { display: flex; justify-content: flex-end; }

    .badge {
      display: inline-block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase; padding: 5px 10px; border-radius: 999px; white-space: nowrap;
    }
    .badge.ok { background: #ecfdf3; color: #067647; }
    .badge.low { background: #fffaeb; color: #b54708; }
    .badge.out { background: #fef3f2; color: #b42318; }

    .empty {
      text-align: center; padding: 56px 20px; color: var(--luxe-text-muted);
    }
    .empty mat-icon { font-size: 42px; width: 42px; height: 42px; color: var(--luxe-gold); margin-bottom: 10px; }

    @media (max-width: 1100px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .page-head { align-items: stretch; }
      .header-actions { width: 100%; }
      .header-actions a, .header-actions button { flex: 1; }
      .cat { width: 100%; }
      .result-count { margin-left: 0; width: 100%; }
      .row { grid-template-columns: 52px 1fr auto; }
      .row.head { display: none; }
      .price, .badge, .row-actions { grid-column: 2; justify-self: start; }
    }
    @media (max-width: 480px) {
      .kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
      .kpi { padding: 14px; }
      .kpi-value { font-size: 1.35rem; }
    }
  `]
})
export class ProductsManagerComponent implements OnInit, OnDestroy {
  products: any[] = [];
  categories: any[] = [];
  summary: StockSummary = { skuCount: 0, units: 0, outOfStock: 0, lowStock: 0, lowThreshold: 10 };
  total = 0;
  loading = true;
  searchTerm = '';
  categoryFilter = 'all';

  get parentCategories(): any[] {
    return this.categories.filter((c) => !c.parent_id);
  }

  get listCategoryFilter(): string | undefined {
    if (this.categoryFilter === 'all' || this.categoryFilter.startsWith('sub:')) return undefined;
    return this.categoryFilter;
  }

  get listSubcategoryFilter(): string | undefined {
    return this.categoryFilter.startsWith('sub:') ? this.categoryFilter.slice(4) : undefined;
  }

  childrenOfParent(parentId: string): any[] {
    return this.categories.filter((c) => c.parent_id === parentId);
  }

  subsForSelectedParent(): any[] {
    const name = this.productForm?.get('category')?.value;
    const parent = this.categories.find((c) => c.name === name && !c.parent_id);
    return parent ? this.childrenOfParent(parent.id) : [];
  }

  onParentCategoryChange() {
    const current = this.productForm.get('subcategory')?.value;
    if (current && !this.subsForSelectedParent().some((s) => s.name === current)) {
      this.productForm.patchValue({ subcategory: '' });
    }
  }

  pageIndex = 0;
  pageSize = 10;
  private lowThreshold = 10;

  private searchChange$ = new Subject<void>();
  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  productForm!: FormGroup;
  showForm = false;
  isEditMode = false;
  editingProductId: string | null = null;
  uploading = false;
  galleryImages: string[] = [];
  readonly maxImages = 8;

  showImport = false;
  importing = false;
  defaultStock = 100;
  importReport: any = null;
  importFileName = '';

  constructor(
    private crud: CrudService,
    private api: ApiService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private confirm: ConfirmService
  ) {}

  ngOnInit() {
    this.searchChange$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());

    this.reload$
      .pipe(
        tap(() => { this.loading = true; }),
        switchMap(() => this.crud.getPage<any>('products', {
          page: this.pageIndex + 1,
          limit: this.pageSize,
          search: this.searchTerm.trim() || undefined,
          category: this.listCategoryFilter,
          subcategory: this.listSubcategoryFilter,
          sort: 'newest:desc'
        })),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: page => {
          this.products = page.data;
          this.total = page.total;
          this.loading = false;
          if (page.data.length === 0 && this.pageIndex > 0) {
            this.pageIndex = Math.max(0, page.pages - 1);
            this.reload$.next();
          }
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Erreur lors du chargement des produits', 'Fermer', { duration: 4000 });
        }
      });

    this.loadProducts();
    this.loadCategories();
    this.loadSummary();
    this.initForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories() {
    this.crud.getAll<any>('categories').subscribe({
      next: data => this.categories = data,
      error: () => this.snackBar.open('Erreur lors du chargement des catégories', 'Fermer', { duration: 4000 })
    });
  }

  loadSummary() {
    this.api.get<StockSummary>('products/stock-summary', { low: this.lowThreshold }).subscribe({
      next: s => this.summary = s,
      error: () => {}
    });
  }

  statusClass(stock: number): string {
    if (stock <= 0) return 'out';
    if (stock <= this.lowThreshold) return 'low';
    return 'ok';
  }

  statusLabel(stock: number): string {
    if (stock <= 0) return 'Rupture';
    if (stock <= this.lowThreshold) return 'Faible';
    return 'En stock';
  }

  margin(product: { price?: number; cost_price?: number }): number | null {
    const sale = Number(product?.price);
    const cost = Number(product?.cost_price);
    if (!Number.isFinite(sale)) return null;
    return sale - (Number.isFinite(cost) ? cost : 0);
  }

  initForm() {
    this.productForm = this.fb.group({
      reference: [''],
      contenance: [''],
      name: ['', Validators.required],
      category: ['', Validators.required],
      subcategory: [''],
      price: ['', [Validators.required, Validators.min(0)]],
      cost_price: [0, [Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      image_url: [''],
      description: ['']
    });
  }

  photoCount(product: any): number {
    if (Array.isArray(product?.images) && product.images.length) return product.images.length;
    return product?.image_url ? 1 : 0;
  }

  syncCover() {
    this.productForm.patchValue({ image_url: this.galleryImages[0] || '' });
  }

  moveImage(index: number, direction: number) {
    const next = index + direction;
    if (next < 0 || next >= this.galleryImages.length) return;
    const copy = [...this.galleryImages];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    this.galleryImages = copy;
    this.syncCover();
  }

  removeImage(index: number) {
    this.galleryImages = this.galleryImages.filter((_, i) => i !== index);
    this.syncCover();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const room = this.maxImages - this.galleryImages.length;
    if (room <= 0) {
      this.snackBar.open('Maximum 8 photos par produit', 'Fermer', { duration: 3000 });
      return;
    }
    const queue = files.slice(0, room);
    this.uploadNext(queue, 0);
  }

  private async uploadNext(files: File[], index: number) {
    if (index >= files.length) {
      this.uploading = false;
      this.snackBar.open(
        files.length > 1 ? `${files.length} photos compressées et ajoutées` : 'Photo compressée et ajoutée',
        'OK',
        { duration: 2500 }
      );
      return;
    }
    this.uploading = true;
    try {
      const compressed = await compressImageFile(files[index], 'product');
      const formData = new FormData();
      formData.append('image', compressed);
      this.api.post<{ url: string }>('uploads', formData).subscribe({
        next: (res) => {
          if (res?.url && !this.galleryImages.includes(res.url)) {
            this.galleryImages = [...this.galleryImages, res.url];
            this.syncCover();
          }
          this.uploadNext(files, index + 1);
        },
        error: (err) => {
          this.uploading = false;
          this.snackBar.open(imageUploadErrorMessage(err), 'Fermer', { duration: 5000 });
        }
      });
    } catch (err) {
      this.uploading = false;
      this.snackBar.open(imageUploadErrorMessage(err), 'Fermer', { duration: 5000 });
    }
  }

  loadProducts() {
    this.reload$.next();
  }

  resetPage() {
    this.pageIndex = 0;
    this.searchChange$.next();
  }

  onPageChange(index: number) {
    this.pageIndex = index;
    this.reload$.next();
  }

  toggleImport() {
    this.showImport = !this.showImport;
    if (!this.showImport) {
      this.importReport = null;
      this.importFileName = '';
    }
  }

  onCsvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importFileName = file.name;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('default_stock', String(this.defaultStock ?? 0));

    this.importing = true;
    this.importReport = null;
    this.api.post<any>('products/import', formData).subscribe({
      next: (report) => {
        this.importing = false;
        this.importReport = report;
        this.loadProducts();
        this.loadCategories();
        this.loadSummary();
        this.snackBar.open(
          `${report.created} produit(s) créé(s), ${report.updated} mis à jour`,
          'OK',
          { duration: 4000 }
        );
      },
      error: (err) => {
        this.importing = false;
        const msg = err?.error?.message || "Erreur lors de l'import du fichier";
        this.snackBar.open(msg, 'Fermer', { duration: 6000 });
      }
    });
    input.value = '';
  }

  downloadTemplate() {
    const rows = [
      'Ref;Categorie;SousCategorie;Designation;Contenance;Prix;PrixAchat;Image;Image2;Stock',
      'NEL-001;Soins Visage;Sérums;Crème de Nuit Régénérante;50 ml;89,900;42,000;creme-nuit.jpg;creme-nuit-2.jpg;25',
      'NEL-002;Parfums;;Eau de Parfum Oud;100 ml;149,000;70,000;https://exemple.com/parfum.jpg;;10'
    ];
    const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-import-produits.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.isEditMode = false;
      this.editingProductId = null;
      this.galleryImages = [];
      this.productForm.reset({ stock: 0, cost_price: 0, image_url: '', subcategory: '' });
    }
  }

  editProduct(product: any) {
    this.isEditMode = true;
    this.editingProductId = product.id;
    this.showForm = true;
    this.showImport = false;
    this.galleryImages = Array.isArray(product.images) && product.images.length
      ? [...product.images]
      : (product.image_url ? [product.image_url] : []);
    this.productForm.patchValue({
      reference: product.reference,
      contenance: product.contenance,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory || '',
      price: product.price,
      cost_price: product.cost_price ?? 0,
      stock: product.stock,
      image_url: this.galleryImages[0] || '',
      description: product.description
    });
  }

  saveProduct() {
    if (this.productForm.invalid) return;
    if (!this.galleryImages.length) {
      this.snackBar.open('Ajoutez au moins une photo', 'Fermer', { duration: 3000 });
      return;
    }

    const payload = {
      ...this.productForm.value,
      image_url: this.galleryImages[0],
      images: this.galleryImages
    };
    if (!payload.subcategory) payload.subcategory = null;

    if (this.isEditMode && this.editingProductId) {
      this.crud.update('products', this.editingProductId, payload).subscribe({
        next: () => {
          this.snackBar.open('Produit mis à jour avec succès', 'OK', { duration: 3000 });
          this.loadProducts();
          this.loadSummary();
          this.toggleForm();
        },
        error: () => {
          this.snackBar.open('Erreur lors de la mise à jour du produit', 'Fermer', { duration: 3000 });
        }
      });
    } else {
      this.crud.create('products', payload).subscribe({
        next: () => {
          this.snackBar.open('Produit créé avec succès', 'OK', { duration: 3000 });
          this.loadProducts();
          this.loadCategories();
          this.loadSummary();
          this.toggleForm();
        },
        error: () => {
          this.snackBar.open('Erreur lors de la création du produit', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  async deleteProduct(id: string) {
    const ok = await this.confirm.ask({
      danger: true,
      title: 'Supprimer ce produit ?',
      message: 'La fiche disparaîtra du catalogue. Cette action est définitive.',
      confirmLabel: 'Supprimer'
    });
    if (!ok) return;
    this.crud.delete('products', id).subscribe({
      next: () => {
        this.snackBar.open('Produit supprimé', 'OK', { duration: 3000 });
        this.loadProducts();
        this.loadSummary();
      },
      error: () => {
        this.snackBar.open('Erreur lors de la suppression du produit', 'Fermer', { duration: 3000 });
      }
    });
  }
}
