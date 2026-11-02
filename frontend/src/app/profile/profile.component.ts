import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { CrudService } from '../services/crud.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BreadcrumbComponent } from '../components/breadcrumb/breadcrumb.component';
import { FormatCurrencyPipe } from '../pipes/format-currency.pipe';

const STATUS_TRANSLATIONS: { [key: string]: string } = {
  'pending': 'En attente',
  'confirmed': 'Confirmée',
  'shipped': 'Expédiée',
  'delivered': 'Livrée',
  'cancelled': 'Annulée'
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule, MatSnackBarModule, BreadcrumbComponent, FormatCurrencyPipe],
  template: `
    <div class="profile-page">
      <div class="container">
        <div class="profile-crumbs">
          <app-breadcrumb [crumbs]="[{label: 'Mon Profil'}]"></app-breadcrumb>
        </div>

        <div class="profile-header">
          <div class="avatar">{{ initials }}</div>
          <h1>{{ user?.first_name }} {{ user?.last_name }}</h1>
          <span class="role-badge" [ngClass]="user?.role || ''">{{ user?.role }}</span>
          <div class="points-badge" *ngIf="user?.role === 'client'">
            <mat-icon>stars</mat-icon>
            {{ user?.loyalty_points || 0 }} point{{ (user?.loyalty_points || 0) > 1 ? 's' : '' }} fidélité
          </div>
        </div>

        <div class="profile-grid">
          <!-- Infos -->
          <div class="info-card card">
            <div class="card-title">
              <h3>Informations personnelles</h3>
              <button mat-stroked-button *ngIf="!isEditing" (click)="toggleEdit()">MODIFIER</button>
            </div>

            <div class="info-body" *ngIf="!isEditing">
              <div class="info-row"><span class="label">Prénom</span><span class="value">{{ user?.first_name }}</span></div>
              <div class="info-row"><span class="label">Nom</span><span class="value">{{ user?.last_name }}</span></div>
              <div class="info-row"><span class="label">Email</span><span class="value">{{ user?.email }}</span></div>
              <div class="info-row" *ngIf="user?.role === 'client'"><span class="label">Points fidélité</span><span class="value">{{ user?.loyalty_points || 0 }}</span></div>
              <div class="info-row"><span class="label">Membre depuis</span><span class="value">{{ createdDate }}</span></div>
            </div>

            <form class="edit-form" *ngIf="isEditing">
              <mat-form-field appearance="outline">
                <mat-label>Prénom</mat-label>
                <input matInput [(ngModel)]="editData.first_name" name="first">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Nom</mat-label>
                <input matInput [(ngModel)]="editData.last_name" name="last">
              </mat-form-field>
              <div class="actions">
                <button mat-flat-button color="primary" (click)="saveProfile()">Enregistrer</button>
                <button mat-stroked-button (click)="toggleEdit()">Annuler</button>
              </div>
            </form>
          </div>

          <!-- Accès rapides -->
          <div class="side-col">
            <div class="card">
              <div class="card-title"><h3>Accès rapides</h3></div>
              <a class="quick-link" routerLink="/wishlist"><mat-icon>favorite_border</mat-icon> Mes favoris</a>
              <a class="quick-link" routerLink="/collection"><mat-icon>storefront</mat-icon> Continuer mes achats</a>
              <a class="quick-link" routerLink="/admin" *ngIf="canAccessAdmin"><mat-icon>admin_panel_settings</mat-icon> Espace administration</a>
              <button class="quick-link" (click)="onLogout()"><mat-icon>logout</mat-icon> Déconnexion</button>
            </div>
            <div class="card support-card">
              <mat-icon>support_agent</mat-icon>
              <p>Besoin d'aide avec une commande ?</p>
              <span>contact&#64;nelya.tn &mdash; +216 22 580 632</span>
            </div>
          </div>
        </div>

        <!-- Historique -->
        <section class="orders-section">
          <div class="orders-head">
            <h2>{{ isStaff ? 'Mes achats' : 'Mes Commandes' }}</h2>
            <div class="orders-line"></div>
          </div>

          <div class="orders-list" *ngIf="orders.length; else noOrders">
            <div class="order-card card" *ngFor="let order of orders">
              <div class="order-top">
                <div class="order-id">
                  <strong>#{{ shortId(order.id) }}</strong>
                  <span>{{ order.created_at | date: 'dd MMM yyyy' }}</span>
                </div>
                <span class="status-badge" [ngClass]="'status-' + order.status">{{ translateStatus(order.status) }}</span>
              </div>
              <div class="order-mid">
                <div class="order-items">
                  <p *ngFor="let item of order.items">
                    <span class="qty">{{ item.quantity }} ×</span> {{ item.Product?.name || 'Produit' }}
                  </p>
                </div>
                <div class="order-delivery">
                  <span><mat-icon>location_on</mat-icon> {{ order.shipping_address }}</span>
                  <span *ngIf="order.phone"><mat-icon>phone_in_talk</mat-icon> {{ order.phone }}</span>
                </div>
              </div>
              <div class="order-bottom">
                <span class="order-total">Total : <strong>{{ order.total_amount | formatCurrency }}</strong></span>
                <span class="order-points" *ngIf="order.points_awarded > 0">+{{ order.points_awarded }} pts</span>
                <span class="order-pay">{{ order.notes ? extractPay(order.notes) : '' }}</span>
              </div>
            </div>
          </div>

          <ng-template #noOrders>
            <div class="no-orders">
              <mat-icon>receipt_long</mat-icon>
              <h3>Aucune commande pour le moment</h3>
              <p *ngIf="!isStaff">Parcourez notre collection et laissez-vous tenter.</p>
              <p *ngIf="isStaff">Les commandes des clients se gèrent dans l’espace administration.</p>
              <button *ngIf="!isStaff" mat-flat-button color="primary" routerLink="/collection">DÉCOUVRIR LA BOUTIQUE</button>
              <a *ngIf="canAccessAdmin" mat-flat-button color="primary" routerLink="/admin">ACCÉDER À L’ADMINISTRATION</a>
            </div>
          </ng-template>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { min-height: 70vh; padding-top: 130px; }
    .container { max-width: 1240px; margin: 0 auto; padding: 0 40px; }
    .profile-crumbs { margin-bottom: 30px; }

    .profile-header { text-align: center; margin-bottom: 54px; }
    .avatar {
      width: 108px; height: 108px; border-radius: 50%; margin: 0 auto 22px;
      background: linear-gradient(135deg, var(--luxe-black), #2c2c2c);
      color: var(--luxe-gold); font-family: var(--font-heading); font-size: 2.2rem;
      display: flex; align-items: center; justify-content: center; letter-spacing: 2px;
      box-shadow: var(--shadow-elevated);
    }
    .profile-header h1 { font-family: var(--font-heading); font-size: 2.4rem; color: var(--luxe-black); margin: 0 0 14px; font-weight: 500; }
    .role-badge { display: inline-block; padding: 6px 18px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
    .role-badge.admin { background: var(--luxe-gold); color: var(--luxe-black); }
    .role-badge.client { background: var(--luxe-success-bg); color: var(--luxe-success); }
    .role-badge.seller { background: var(--luxe-info-bg); color: var(--luxe-info); }
    .points-badge {
      display: inline-flex; align-items: center; gap: 8px; margin-top: 16px;
      padding: 8px 16px; border-radius: var(--radius-full);
      background: var(--luxe-offwhite); border: 1px solid var(--luxe-border);
      color: var(--luxe-black); font-size: 0.88rem; font-weight: 600;
    }
    .points-badge mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--luxe-gold); }

    .profile-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 34px; align-items: start; }
    .card {
      background: var(--luxe-white); border: 1px solid var(--luxe-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-subtle); padding: 30px;
    }
    .card-title { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--luxe-border); padding-bottom: 18px; margin-bottom: 20px; }
    .card-title h3 { font-family: var(--font-heading); font-size: 1.3rem; color: var(--luxe-black); margin: 0; font-weight: 500; }
    .card-title button { font-size: 0.72rem; letter-spacing: 1.5px; }

    .info-body { display: flex; flex-direction: column; gap: 16px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 4px 0; }
    .info-row .label { color: var(--luxe-text-muted); font-size: 0.88rem; }
    .info-row .value { font-weight: 600; color: var(--luxe-black); text-align: right; }
    .edit-form { display: flex; flex-direction: column; gap: 6px; }
    .actions { display: flex; gap: 14px; margin-top: 14px; }
    .actions button { flex: 1; }

    .side-col { display: flex; flex-direction: column; gap: 34px; }
    .quick-link {
      display: flex; align-items: center; gap: 14px; width: 100%;
      padding: 13px 0; color: var(--luxe-charcoal); text-decoration: none;
      border: none; background: none; cursor: pointer; font-family: var(--font-body);
      font-size: 0.95rem; border-bottom: 1px solid var(--luxe-border); text-align: left;
      transition: color 0.3s ease, padding-left 0.3s ease;
    }
    .quick-link:last-of-type { border-bottom: none; }
    .quick-link mat-icon { color: var(--luxe-gold); font-size: 22px; width: 22px; height: 22px; }
    .quick-link:hover { color: var(--luxe-gold); padding-left: 6px; }
    .support-card { text-align: center; background: var(--luxe-offwhite); }
    .support-card mat-icon { color: var(--luxe-gold); font-size: 40px; width: 40px; height: 40px; }
    .support-card p { color: var(--luxe-black); font-weight: 500; margin: 12px 0 6px; }
    .support-card span { color: var(--luxe-text-muted); font-size: 0.85rem; font-weight: 300; }

    /* Commandes */
    .orders-section { margin-top: 70px; padding-bottom: 60px; }
    .orders-head { margin-bottom: 34px; }
    .orders-head h2 { font-family: var(--font-heading); font-size: 1.9rem; color: var(--luxe-black); font-weight: 500; margin: 0; }
    .orders-line { width: 44px; height: 2px; background: var(--luxe-gold); border-radius: 2px; margin-top: 14px; }
    .orders-list { display: flex; flex-direction: column; gap: 22px; }
    .order-card { padding: 24px 28px; transition: box-shadow 0.3s ease, transform 0.3s ease; }
    .order-card:hover { box-shadow: var(--shadow-elevated); transform: translateY(-2px); }
    .order-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .order-id { display: flex; flex-direction: column; gap: 3px; }
    .order-id strong { color: var(--luxe-black); letter-spacing: 1px; font-size: 0.95rem; }
    .order-id span { color: var(--luxe-text-muted); font-size: 0.8rem; }
    .order-mid { display: flex; justify-content: space-between; gap: 30px; flex-wrap: wrap; border-top: 1px dashed var(--luxe-border); border-bottom: 1px dashed var(--luxe-border); padding: 16px 0; }
    .order-items { flex: 1; min-width: 200px; }
    .order-items p { margin: 6px 0; color: var(--luxe-charcoal); font-size: 0.92rem; }
    .order-items .qty { color: var(--luxe-gold); font-weight: 600; }
    .order-delivery { display: flex; flex-direction: column; gap: 8px; }
    .order-delivery span { display: flex; align-items: center; gap: 8px; color: var(--luxe-text-muted); font-size: 0.85rem; }
    .order-delivery mat-icon { font-size: 17px; width: 17px; height: 17px; color: var(--luxe-gold); }
    .order-bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
    .order-total { color: var(--luxe-text-muted); font-size: 0.92rem; }
    .order-total strong { color: var(--luxe-black); font-family: var(--font-heading); font-size: 1.25rem; }
    .order-points { color: var(--luxe-gold); font-weight: 700; font-size: 0.88rem; letter-spacing: 0.5px; }
    .order-pay { color: var(--luxe-text-muted); font-size: 0.8rem; }

    .no-orders { text-align: center; padding: 70px 20px; border: 1px dashed var(--luxe-border); border-radius: var(--radius-lg); }
    .no-orders mat-icon { font-size: 54px; width: 54px; height: 54px; color: var(--luxe-gold); }
    .no-orders h3 { font-family: var(--font-heading); color: var(--luxe-black); margin: 16px 0 8px; font-size: 1.4rem; }
    .no-orders p { color: var(--luxe-text-muted); margin-bottom: 26px; font-weight: 300; }

    @media (max-width: 960px) {
      .profile-page { padding-top: 110px; }
      .container { padding: 0 20px; }
      .profile-grid { grid-template-columns: 1fr; }
      .order-mid { flex-direction: column; gap: 12px; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  isEditing = false;
  editData: any = {};
  orders: any[] = [];

  constructor(
    private authService: AuthService,
    private crudService: CrudService,
    private snackBar: MatSnackBar
  ) {}

  get isStaff(): boolean {
    return this.user?.role === 'admin' || this.user?.role === 'seller';
  }

  get canAccessAdmin(): boolean {
    return this.authService.canAccessAdmin;
  }

  get initials(): string {
    const u = this.user;
    if (!u) return '';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase();
  }

  get createdDate(): string {
    const created = (this.user as any)?.created_at;
    return created ? new Date(created).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—';
  }

  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.authService.currentUser$.pipe(
      distinctUntilChanged((a, b) => a?.id === b?.id),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => {
      this.user = user;
      if (user) {
        this.editData = { ...user };
        this.loadOrders();
      }
    });
  }

  loadOrders() {
    this.crudService.getAll<any>('orders', { mine: '1' }).subscribe({
      next: orders => {
        this.orders = (orders || []).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      },
      error: () => { this.orders = []; }
    });
  }

  shortId(id: string): string {
    return id ? String(id).replace(/-/g, '').slice(0, 8).toUpperCase() : '—';
  }

  translateStatus(status: string): string {
    return STATUS_TRANSLATIONS[status] || status;
  }

  extractPay(notes: string): string {
    const m = notes ? notes.match(/Paiement:\s*(.*)/) : null;
    return m ? m[1] : '';
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.user) this.editData = { ...this.user };
  }

  saveProfile() {
    if (!this.user?.id) return;
    this.crudService.update('users', this.user.id, {
      first_name: this.editData.first_name,
      last_name: this.editData.last_name
    }).subscribe({
      next: () => {
        this.snackBar.open('Profil mis à jour avec succès', 'OK', { duration: 3000 });
        this.isEditing = false;
        setTimeout(() => window.location.reload(), 800);
      },
      error: () => {
        this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
  }

  onLogout() {
    this.authService.logout();
    window.location.href = '/auth/login';
  }
}
