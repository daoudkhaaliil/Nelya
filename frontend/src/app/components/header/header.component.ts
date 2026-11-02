import { Component, OnInit, HostListener, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';
import { BrandService } from '../../services/brand.service';
import { CatalogService } from '../../services/catalog.service';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, ImageUrlPipe],
  template: `
    <nav class="luxe-nav" [class.scrolled]="scrolled">
      <div class="luxe-nav-inner">
        <a class="luxe-logo" routerLink="/" [attr.aria-label]="brand.name + ' — accueil'">
          <img [src]="brand.logoUrl | imageUrl" [alt]="brand.name" width="64" height="64" decoding="async">
        </a>

        <div class="luxe-nav-links" [class.open]="mobileOpen">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="mobileOpen = false">ACCUEIL</a>

          <button class="nav-trigger" [matMenuTriggerFor]="catMenu">
            BOUTIQUE <mat-icon>expand_more</mat-icon>
          </button>
          <mat-menu #catMenu="matMenu" class="luxe-megamenu" xPosition="after">
            <button mat-menu-item routerLink="/collection" (click)="mobileOpen = false">
              <mat-icon>grid_view</mat-icon> Tous les produits
            </button>
            <ng-container *ngFor="let cat of navTree; trackBy: trackByName">
              <button mat-menu-item *ngIf="!cat.children.length" [routerLink]="['/collection']" [queryParams]="{cat: cat.name}" (click)="mobileOpen = false">
                <mat-icon>arrow_forward_ios</mat-icon> {{ cat.name }}
              </button>
              <button mat-menu-item *ngIf="cat.children.length" [matMenuTriggerFor]="childMenu" [matMenuTriggerData]="{ cat: cat }">
                <mat-icon>arrow_forward_ios</mat-icon> {{ cat.name }}
              </button>
            </ng-container>
          </mat-menu>
          <mat-menu #childMenu="matMenu">
            <ng-template matMenuContent let-cat="cat">
              <button mat-menu-item [routerLink]="['/collection']" [queryParams]="{cat: cat.name}" (click)="mobileOpen = false">
                Tout {{ cat.name }}
              </button>
              <button mat-menu-item *ngFor="let child of cat.children; trackBy: trackByName" [routerLink]="['/collection']" [queryParams]="{cat: cat.name, sub: child.name}" (click)="mobileOpen = false">
                {{ child.name }}
              </button>
            </ng-template>
          </mat-menu>

          <a routerLink="/collection" *ngIf="navTree.length === 0" routerLinkActive="active">BOUTIQUE</a>
          <a routerLink="/auth/login" *ngIf="!isLoggedIn" (click)="mobileOpen = false">CONNEXION</a>

          <form class="luxe-mobile-search" (submit)="search(searchInput.value); $event.preventDefault()" *ngIf="mobileOpen">
            <input #searchInput type="search" placeholder="Rechercher un produit..." aria-label="Rechercher">
            <button type="submit" aria-label="Lancer la recherche"><mat-icon>search</mat-icon></button>
          </form>
        </div>

        <div class="luxe-actions">
          <button class="luxe-icon-btn luxe-search-toggle" (click)="searchOpen = !searchOpen" [attr.aria-label]="searchOpen ? 'Fermer la recherche' : 'Ouvrir la recherche'">
            <mat-icon>{{ searchOpen ? 'close' : 'search' }}</mat-icon>
          </button>

          <button class="luxe-icon-btn" routerLink="/wishlist" aria-label="Mes favoris">
            <mat-icon [matBadge]="wishlistCount" matBadgeColor="warn">favorite_border</mat-icon>
          </button>

          <button class="luxe-icon-btn" routerLink="/cart" aria-label="Mon panier">
            <mat-icon [matBadge]="cartCount" matBadgeColor="warn">shopping_bag_outlined</mat-icon>
          </button>

          <a class="luxe-points" routerLink="/profile" *ngIf="isLoggedIn && loyaltyPoints !== null" [attr.aria-label]="loyaltyPoints + ' points fidélité'">
            <mat-icon>stars</mat-icon>
            <span>{{ loyaltyPoints }}</span>
          </a>

          <button mat-icon-button class="luxe-icon-btn" [matMenuTriggerFor]="profileMenu" *ngIf="isLoggedIn" aria-label="Mon compte">
            <mat-icon>person_outline</mat-icon>
          </button>
          <mat-menu #profileMenu="matMenu" xPosition="before">
            <button mat-menu-item routerLink="/profile"><mat-icon>account_circle</mat-icon> Mon Profil</button>
            <button mat-menu-item routerLink="/admin" *ngIf="canAccessAdmin"><mat-icon>admin_panel_settings</mat-icon> Administration</button>
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon> Déconnexion</button>
          </mat-menu>

          <button class="luxe-icon-btn luxe-burger" (click)="mobileOpen = !mobileOpen" [attr.aria-expanded]="mobileOpen" aria-label="Menu">
            <mat-icon>{{ mobileOpen ? 'close' : 'menu' }}</mat-icon>
          </button>
        </div>
      </div>

      <div class="luxe-searchbar" *ngIf="searchOpen">
        <form (submit)="search(searchDesktop.value); $event.preventDefault()">
          <mat-icon class="searchbar-icon">search</mat-icon>
          <input #searchDesktop type="search" placeholder="Que recherchez-vous ? Parfums, soins, maquillage..." aria-label="Rechercher" autofocus>
          <button type="submit">RECHERCHER</button>
        </form>
      </div>
    </nav>
  `,
  styles: [`
    .luxe-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--luxe-border);
      transition: box-shadow 0.3s ease, background 0.3s ease;
    }
    .luxe-nav.scrolled { box-shadow: var(--shadow-elevated); background: rgba(255,255,255,0.96); }
    .luxe-nav-inner {
      height: 80px; max-width: 1440px; margin: 0 auto; padding: 0 40px;
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
    }
    .luxe-logo {
      display: flex; align-items: center; flex-shrink: 0;
      text-decoration: none; line-height: 0;
    }
    .luxe-logo img {
      height: 64px; width: 64px; display: block;
      object-fit: cover; border-radius: 50%;
    }
    .luxe-nav-links { display: flex; align-items: center; gap: 32px; margin: 0 auto; }
    .luxe-nav-links a, .nav-trigger {
      position: relative; background: none; border: none; cursor: pointer;
      font-family: var(--font-body); color: var(--luxe-charcoal);
      font-size: 0.75rem; font-weight: 600; letter-spacing: 2px;
      text-transform: uppercase; text-decoration: none;
      padding: 6px 0; transition: color 0.3s ease;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .luxe-nav-links a::after, .nav-trigger::after {
      content: ''; position: absolute; left: 0; bottom: 0; width: 0; height: 1px;
      background: var(--luxe-gold); transition: width 0.3s ease;
    }
    .luxe-nav-links a:hover, .nav-trigger:hover { color: var(--luxe-gold); }
    .luxe-nav-links a:hover::after, .nav-trigger:hover::after, .luxe-nav-links a.active::after { width: 100%; }
    .nav-trigger mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .luxe-actions { display: flex; align-items: center; gap: 10px; }
    .luxe-icon-btn {
      position: relative; width: 42px; height: 42px; border-radius: 50%;
      border: none; background: transparent; color: var(--luxe-charcoal); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, color 0.3s ease;
    }
    .luxe-icon-btn:hover { background: var(--luxe-offwhite); color: var(--luxe-gold); }
    .luxe-icon-btn mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .luxe-points {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 12px; border-radius: var(--radius-pill);
      background: var(--luxe-offwhite); border: 1px solid var(--luxe-border);
      color: var(--luxe-black); text-decoration: none;
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.4px;
      transition: border-color 0.3s ease, color 0.3s ease;
    }
    .luxe-points mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--luxe-gold); }
    .luxe-points:hover { border-color: var(--luxe-gold); color: var(--luxe-gold); }
    .luxe-burger { display: none; }

    .luxe-searchbar {
      border-top: 1px solid var(--luxe-border);
      background: var(--luxe-white);
      padding: 14px 0;
      animation: slideDown 0.3s ease;
    }
    .luxe-searchbar form {
      max-width: 1440px; margin: 0 auto; padding: 0 40px;
      display: flex; align-items: center; gap: 16px;
    }
    .searchbar-icon { color: var(--luxe-gold); font-size: 26px; width: 26px; height: 26px; }
    .luxe-searchbar input {
      flex: 1; border: none; outline: none; background: transparent;
      font-family: var(--font-heading); font-size: 1.2rem; color: var(--luxe-black);
    }
    .luxe-searchbar input::placeholder { color: var(--luxe-text-muted); font-family: var(--font-body); font-weight: 300; }
    .luxe-searchbar button {
      background: var(--luxe-black); color: var(--luxe-gold); border: none; cursor: pointer;
      padding: 12px 28px; border-radius: var(--radius-pill);
      font-size: 0.72rem; letter-spacing: 2px; font-weight: 600; text-transform: uppercase;
      transition: background 0.3s ease, transform 0.3s ease;
    }
    .luxe-searchbar button:hover { background: var(--luxe-gold); color: var(--luxe-black); transform: translateY(-2px); }
    .luxe-mobile-search { display: none; }

    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 960px) {
      .luxe-nav-inner { padding: 0 20px; }
      .luxe-nav-links {
        display: none; position: fixed; top: 80px; left: 0; right: 0;
        background: var(--luxe-white); border-bottom: 1px solid var(--luxe-border);
        box-shadow: var(--shadow-elevated);
        flex-direction: column; align-items: stretch; gap: 0;
        padding: 12px 20px 20px; margin: 0;
        max-height: calc(100vh - 80px); overflow-y: auto;
      }
      .luxe-nav-links.open { display: flex; }
      .luxe-nav-links a, .nav-trigger { padding: 16px 0; font-size: 0.85rem; border-bottom: 1px solid var(--luxe-border); }
      .luxe-nav-links a::after, .nav-trigger::after { display: none; }
      .luxe-burger { display: inline-flex; }
      .luxe-search-toggle { display: none; }
      .luxe-mobile-search { display: flex; gap: 10px; padding-top: 16px; }
      .luxe-mobile-search input {
        flex: 1; padding: 12px 16px; border: 1px solid var(--luxe-border);
        border-radius: var(--radius-pill); outline: none; font-family: var(--font-body);
      }
      .luxe-mobile-search input:focus { border-color: var(--luxe-gold); }
      .luxe-mobile-search button {
        width: 46px; border-radius: 50%; border: 1px solid var(--luxe-border);
        background: var(--luxe-black); color: var(--luxe-gold); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .luxe-searchbar form { padding: 0 20px; }
    }
  `]
})
export class HeaderComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  cartCount = 0;
  wishlistCount = 0;
  isLoggedIn = false;
  canAccessAdmin = false;
  loyaltyPoints: number | null = null;
  navTree: { name: string; children: { name: string }[] }[] = [];
  scrolled = false;
  mobileOpen = false;
  searchOpen = false;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private wishlistService: WishlistService,
    private catalog: CatalogService,
    public brand: BrandService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cartService.cartItems$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(items => {
      this.cartCount = items.reduce((acc, i) => acc + i.quantity, 0);
    });
    this.wishlistService.ids$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(ids => { this.wishlistCount = ids.length; });
    this.authService.refreshMe();
    this.authService.currentUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
      this.isLoggedIn = !!user;
      this.canAccessAdmin = this.authService.canAccessAdmin;
      this.loyaltyPoints = user?.role === 'client' ? Number(user.loyalty_points || 0) : null;
    });
    this.catalog.getMeta().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: meta => {
        this.navTree = (meta.categories || [])
          .filter((c) => c.name && c.name !== 'Promotions')
          .map((root) => ({
            name: root.name,
            children: (root.children || []).map((child) => ({ name: child.name }))
          }));
      },
      error: () => { this.navTree = []; }
    });
  }

  @HostListener('window:scroll', [])
  onScroll() {
    this.scrolled = window.scrollY > 10;
  }

  trackByName(_index: number, item: { name?: string }): string {
    return item?.name || String(_index);
  }

  search(term: string) {
    const q = (term || '').trim();
    this.mobileOpen = false;
    this.searchOpen = false;
    this.router.navigate(['/collection'], q ? { queryParams: { q } } : {});
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
