import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { CatalogMeta } from './catalog.types';

/** Un seul GET /products/meta partagé entre header, accueil et collection. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private meta$?: Observable<CatalogMeta>;

  constructor(private api: ApiService) {}

  getMeta(): Observable<CatalogMeta> {
    if (!this.meta$) {
      this.meta$ = this.api.get<CatalogMeta>('products/meta').pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.meta$;
  }

  invalidate(): void {
    this.meta$ = undefined;
  }
}
