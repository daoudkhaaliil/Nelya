import { Routes } from '@angular/router';

export const PRODUCT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./collection/collection.component').then(m => m.CollectionComponent) },
  { path: ':id', loadComponent: () => import('./product-detail/product-detail.component').then(m => m.ProductDetailComponent) }
];
