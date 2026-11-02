import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrudService } from '../../services/crud.service';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfirmService } from '../../services/confirm.service';
import { childrenOf, isRootCategory } from '../../services/catalog.types';
import { CatalogService } from '../../services/catalog.service';

@Component({
  selector: 'app-categories-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="manager-container fade-in">
      <div class="header">
        <div>
          <h2 class="luxury-title">Gestion des Catégories</h2>
          <p>Catégories et sous-catégories affichées dans le menu et les filtres boutique.</p>
        </div>
        <button mat-raised-button color="primary" (click)="toggleForm()" *ngIf="!showForm">
          <mat-icon>add</mat-icon> Ajouter une catégorie
        </button>
        <button mat-raised-button color="accent" (click)="toggleForm()" *ngIf="showForm">
          <mat-icon>close</mat-icon> Annuler
        </button>
      </div>

      <mat-card class="form-card fade-in" *ngIf="showForm">
        <mat-card-header>
          <mat-card-title>{{ isEditMode ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="categoryForm" (ngSubmit)="saveCategory()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nom</mat-label>
              <input matInput formControlName="name" placeholder="ex: Soins Visage">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Catégorie parente</mat-label>
              <mat-select formControlName="parent_id">
                <mat-option [value]="null">Aucune — catégorie principale</mat-option>
                <mat-option *ngFor="let c of parentOptions" [value]="c.id">{{ c.name }}</mat-option>
              </mat-select>
              <mat-hint>Laissez vide pour une catégorie du menu. Choisissez un parent pour une sous-catégorie.</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description (optionnel)</mat-label>
              <textarea matInput formControlName="description" rows="3" placeholder="Description de la catégorie..."></textarea>
            </mat-form-field>

            <div class="form-actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="categoryForm.invalid">
                <mat-icon>save</mat-icon> Enregistrer
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card" *ngIf="!showForm">
        <table mat-table [dataSource]="categories" class="full-width">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef> Nom </th>
            <td mat-cell *matCellDef="let c">
              <span [class.child-name]="c.parent_id">{{ c.parent_id ? '↳ ' + c.name : c.name }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="parent">
            <th mat-header-cell *matHeaderCellDef> Type </th>
            <td mat-cell *matCellDef="let c"> {{ c.parent_id ? parentLabel(c) : 'Catégorie' }} </td>
          </ng-container>

          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef> Description </th>
            <td mat-cell *matCellDef="let c"> {{c.description || '—'}} </td>
          </ng-container>

          <ng-container matColumnDef="count">
            <th mat-header-cell *matHeaderCellDef> Produits </th>
            <td mat-cell *matCellDef="let c"> {{ productCount(c.name) }} </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef> Actions </th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button color="primary" (click)="editCategory(c)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="deleteCategory(c)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>

        <div class="empty-state" *ngIf="categories.length === 0">
          <mat-icon>category</mat-icon>
          <p>Aucune catégorie créée pour le moment.</p>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .manager-container { padding: 0; min-width: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; gap: 20px; flex-wrap: wrap; }
    .header h2 { font-size: 2rem; margin-bottom: 8px; }
    .header p { color: #666; font-weight: 300; margin: 0; }
    .table-card { border-radius: 15px; overflow-x: auto; }
    .form-card { border-radius: 15px; padding: 20px; margin-bottom: 30px; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 15px; }
    .empty-state { text-align: center; padding: 60px 20px; color: var(--luxe-text-muted); }
    .empty-state mat-icon { font-size: 3rem; width: 48px; height: 48px; margin-bottom: 12px; }
    .child-name { color: #555; padding-left: 8px; }
  `]
})
export class CategoriesManagerComponent implements OnInit {
  categories: any[] = [];
  productCounts: Record<string, number> = {};
  displayedColumns = ['name', 'parent', 'description', 'count', 'actions'];

  categoryForm!: FormGroup;
  showForm = false;
  isEditMode = false;
  editingCategoryId: string | null = null;

  constructor(
    private crud: CrudService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private confirm: ConfirmService,
    private catalog: CatalogService
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();
    this.initForm();
  }

  initForm() {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      parent_id: [null as string | null],
      description: ['']
    });
  }

  get parentOptions(): any[] {
    return this.categories.filter((c) => isRootCategory(c) && c.id !== this.editingCategoryId);
  }

  hasChildren(id: string): boolean {
    return childrenOf(this.categories, id).length > 0;
  }

  parentLabel(category: any): string {
    const parent = this.categories.find((c) => c.id === category.parent_id);
    return parent ? `Sous-catégorie de ${parent.name}` : 'Sous-catégorie';
  }

  loadCategories() {
    this.crud.getAll<any>('categories').subscribe({
      next: data => {
        const roots = data.filter((c: any) => isRootCategory(c)).sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
        this.categories = roots.flatMap((root: any) => [root, ...childrenOf(data, root.id)]);
      },
      error: () => this.snackBar.open('Erreur lors du chargement des catégories', 'Fermer', { duration: 4000 })
    });
  }

  loadProducts() {
    this.crud.getAll<any>('products/meta').subscribe({
      next: (meta: any) => {
        this.productCounts = {};
        for (const cat of meta.categories || []) {
          this.productCounts[cat.name] = cat.count;
          for (const child of cat.children || []) {
            this.productCounts[child.name] = child.count;
          }
        }
      },
      error: () => { this.productCounts = {}; }
    });
  }

  productCount(categoryName: string): number {
    return this.productCounts[categoryName] || 0;
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.isEditMode = false;
      this.editingCategoryId = null;
      this.categoryForm.reset({ parent_id: null, description: '' });
    }
  }

  editCategory(category: any) {
    this.isEditMode = true;
    this.editingCategoryId = category.id;
    this.showForm = true;
    this.categoryForm.patchValue({
      name: category.name,
      parent_id: category.parent_id || null,
      description: category.description
    });
  }

  saveCategory() {
    if (this.categoryForm.invalid) return;
    const payload = { ...this.categoryForm.value, parent_id: this.categoryForm.value.parent_id || null };

    if (this.isEditMode && this.editingCategoryId) {
      this.crud.update('categories', this.editingCategoryId, payload).subscribe({
        next: () => {
          this.snackBar.open('Catégorie mise à jour avec succès', 'OK', { duration: 3000 });
          this.catalog.invalidate();
          this.loadCategories();
          this.toggleForm();
        },
        error: (err) => {
          const msg = err?.error?.error || (err?.error?.error?.includes?.('unique') ? 'Une catégorie avec ce nom existe déjà' : 'Erreur lors de la mise à jour de la catégorie');
          this.snackBar.open(msg, 'Fermer', { duration: 4000 });
        }
      });
    } else {
      this.crud.create('categories', payload).subscribe({
        next: () => {
          this.snackBar.open('Catégorie créée avec succès', 'OK', { duration: 3000 });
          this.catalog.invalidate();
          this.loadCategories();
          this.toggleForm();
        },
        error: (err) => {
          const msg = err?.error?.error || (err?.error?.error?.includes?.('unique') ? 'Une catégorie avec ce nom existe déjà' : 'Erreur lors de la création de la catégorie');
          this.snackBar.open(msg, 'Fermer', { duration: 4000 });
        }
      });
    }
  }

  async deleteCategory(category: any) {
    if (this.hasChildren(category.id)) {
      this.snackBar.open('Retirez d’abord les sous-catégories de cette catégorie.', 'Fermer', { duration: 4000 });
      return;
    }
    const count = this.productCount(category.name);
    const ok = await this.confirm.ask({
      danger: true,
      title: `Supprimer « ${category.name} » ?`,
      message: count > 0
        ? `${count} produit${count > 1 ? 's' : ''} utilise${count > 1 ? 'nt' : ''} encore cette catégorie.`
        : 'Cette catégorie disparaîtra de la boutique.',
      confirmLabel: 'Supprimer'
    });
    if (!ok) return;
    this.crud.delete('categories', category.id).subscribe({
      next: () => {
        this.snackBar.open('Catégorie supprimée', 'OK', { duration: 3000 });
        this.catalog.invalidate();
        this.loadCategories();
      },
      error: () => this.snackBar.open('Erreur lors de la suppression de la catégorie', 'Fermer', { duration: 4000 })
    });
  }
}
