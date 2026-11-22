import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { RoleInfo, StaffMember, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from './intro.component';
import { DICTIONARY } from '@shared/core/i18n.dictionary';

Object.assign(DICTIONARY.ar, { 'users.permsCount': 'صلاحية', 'users.all': 'تحديد الكل', 'users.none': 'إلغاء الكل' });
Object.assign(DICTIONARY.en, { 'users.permsCount': 'permissions', 'users.all': 'Select all', 'users.none': 'Clear all' });

const DEFAULT_PASSWORD = '123456';

// The permissions, grouped like the dashboard menu
const GROUPS: { title: string; items: string[] }[] = [
  { title: 'users.grp.catalog', items: ['products', 'categories', 'brands', 'content', 'company', 'settings'] },
  { title: 'users.grp.sales', items: ['orders', 'orderEmails', 'returnPolicy', 'inquiries', 'discounts', 'promotions', 'coupons', 'auctions', 'wheel', 'reviews'] },
  { title: 'users.grp.inventory', items: ['inventory', 'inventory.dashboard', 'inventory.approve', 'counts', 'history', 'purchaseOrders', 'purchaseOrders.manage', 'warehouses', 'suppliers', 'warehouses.all'] },
  { title: 'users.grp.accounting', items: ['accounting', 'accounting.dashboard', 'accounting.chart', 'accounting.parties', 'accounting.documents', 'accounting.journal', 'accounting.treasury', 'accounting.settlements', 'accounting.approve', 'accounting.settlements.approve', 'accounting.reports', 'accounting.settings'] },
  { title: 'users.grp.people', items: ['users'] },
];

// The permissions that make a role work with the stock of warehouses (such a user is assigned to warehouses)
const STOCK_PERMISSIONS = ['inventory', 'counts', 'history', 'purchaseOrders', 'purchaseOrders.manage'];

interface RoleDraft extends RoleInfo { isNew: boolean; picked: Set<string>; }

// Dashboard users and roles. A role = a name + the screens it may open; a user = a person with one role
// (and, for the stock roles, the warehouses they work with).
@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, FormsModule, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './users-admin.component.html',
})
export class UsersAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly groups = GROUPS;
  readonly tab = signal<'users' | 'roles'>('users');
  readonly users = signal<StaffMember[]>([]);
  readonly roles = signal<RoleInfo[]>([]);
  readonly drafts = signal<RoleDraft[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly saving = signal(false);
  readonly uOpen = signal(false);
  readonly uEditing = signal<StaffMember | null>(null);
  readonly picked = signal<Set<number>>(new Set());
  // The warehouses this person is in charge of (a subset of the picked ones)
  readonly managerPicked = signal<Set<number>>(new Set());
  newRoleName = '';

  // The role shown on the right of the roles tab (the first one until another is chosen)
  readonly selected = signal<string | null>(null);
  readonly current = computed(() => this.drafts().find((r) => r.name === this.selected()) ?? this.drafts()[0] ?? null);

  readonly uColumns: DtColumn[] = [
    { key: 'name', label: 'a.name', value: (u: StaffMember) => u.fullName },
    { key: 'userName', label: 'users.username', value: (u: StaffMember) => u.userName || u.email },
    { key: 'role', label: 'users.role', value: (u: StaffMember) => u.role, filter: 'select', optionLabel: (v: string) => this.roleLabel(v), width: '150px' },
    { key: 'warehouses', label: 'inv.assignedWarehouses', value: (u: StaffMember) => this.warehouseNames(u), filter: 'none' },
    { key: 'active', label: 'a.active', value: (u: StaffMember) => u.isActive, type: 'bool', width: '90px' },
    { key: 'actions', label: '', width: '220px' },
  ];

  readonly uForm = this.fb.group({
    fullName: ['', Validators.required],
    // What the employee types to sign in (no e-mail needed for an internal employee)
    userName: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)]],
    // A temporary password: the user must replace it at the first sign-in, so a simple one is fine
    password: [DEFAULT_PASSWORD, [Validators.required, Validators.minLength(6)]],
    role: ['WarehouseStaff', Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.inventoryApi.getStaff().subscribe((u) => this.users.set(u));
    this.inventoryApi.getWarehouses().subscribe((w) => this.warehouses.set(w));
    this.adminApi.getRoles().subscribe((r) => {
      this.roles.set(r.roles);
      this.drafts.set(r.roles.map((x) => ({ ...x, isNew: false, picked: new Set(x.permissions) })));
    });
  }

  // ---------- helpers
  roleLabel(name: string): string {
    const key = `role.${name}`;
    const text = this.i18n.t(key);

    return text === key ? name : text;
  }

  roleDescription(r: RoleInfo): string {
    const key = `role.${r.name}.hint`;
    const text = this.i18n.t(key);

    return text === key ? this.i18n.t('role.custom.hint') : text;
  }

  warehouseNames(u: StaffMember): string {
    return u.role === 'Admin' ? this.i18n.t('users.allWarehouses') : u.warehouseIds.map((id) => this.warehouses().find((w) => w.id === id)?.name ?? id).join(', ');
  }

  // A role that works with stock needs the warehouses the person is responsible for
  needsWarehouses(): boolean {
    const name = this.uForm.controls.role.value;
    const role = this.roles().find((r) => r.name === name);

    // A role ticked "all warehouses" needs no assignment
    return !!role && role.name !== 'Admin' && !role.permissions.includes('warehouses.all') && role.permissions.some((p) => STOCK_PERMISSIONS.includes(p));
  }

  // ---------- users
  editUser(u: StaffMember | null): void {
    this.uEditing.set(u);
    this.picked.set(new Set(u?.warehouseIds ?? []));
    this.managerPicked.set(new Set(u?.managerWarehouseIds ?? []));
    this.uForm.reset({ fullName: u?.fullName ?? '', userName: u?.userName ?? '', password: DEFAULT_PASSWORD, role: u?.role ?? 'WarehouseStaff', isActive: u?.isActive ?? true });

    // The user name and the password only matter when creating
    for (const c of ['userName', 'password'] as const) {
      if (u) this.uForm.controls[c].disable();
      else this.uForm.controls[c].enable();
    }

    this.uOpen.set(true);
  }

  togglePick(id: number): void {
    const next = new Set(this.picked());
    if (next.has(id)) {
      next.delete(id);

      // Not working in a warehouse any more: not in charge of it either
      const managers = new Set(this.managerPicked());
      managers.delete(id);
      this.managerPicked.set(managers);
    } else {
      next.add(id);
    }

    this.picked.set(next);
  }

  toggleManager(id: number): void {
    const next = new Set(this.managerPicked());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.managerPicked.set(next);
  }

  saveUser(): void {
    if (this.saving()) return;

    if (this.uForm.invalid) {
      this.uForm.markAllAsTouched();
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    if (this.needsWarehouses() && this.picked().size === 0) {
      this.toast.error(this.i18n.t('inv.pickWarehouse'));
      return;
    }

    const v = this.uForm.getRawValue();
    const warehouseIds = this.needsWarehouses() ? [...this.picked()] : [];
    const managerWarehouseIds = warehouseIds.filter((id) => this.managerPicked().has(id));
    const role = v.role ?? 'WarehouseStaff';
    const e = this.uEditing();

    this.saving.set(true);
    const request: Observable<unknown> = e
      ? this.inventoryApi.updateStaff(e.id, { fullName: (v.fullName ?? '').trim(), isActive: !!v.isActive, warehouseIds, role, managerWarehouseIds })
      : this.inventoryApi.createStaff({ userName: (v.userName ?? '').trim().toLowerCase(), fullName: (v.fullName ?? '').trim(), password: v.password ?? '', warehouseIds, role, managerWarehouseIds });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.uOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  // A new temporary password: the user has to replace it at the next sign-in
  resetPassword(u: StaffMember): void {
    const password = prompt(this.i18n.t('inv.resetPasswordPrompt', { name: u.fullName }), DEFAULT_PASSWORD);

    if (password === null) return;

    if (password.trim().length < 6) {
      this.toast.error(this.i18n.t('inv.tempPasswordHint'));
      return;
    }

    this.inventoryApi.resetStaffPassword(u.id, password.trim()).subscribe(() => this.toast.success(this.i18n.t('inv.resetPasswordDone')));
  }

  // ---------- roles
  togglePermission(r: RoleDraft, p: string): void {
    if (r.picked.has(p)) r.picked.delete(p);
    else r.picked.add(p);
  }

  // Every permission of a group at once (or none)
  toggleGroup(r: RoleDraft, items: string[]): void {
    const all = items.every((p) => r.picked.has(p));

    for (const p of items) {
      if (all) r.picked.delete(p);
      else r.picked.add(p);
    }
  }

  groupCount(r: RoleDraft, items: string[]): number {
    return items.filter((p) => r.picked.has(p)).length;
  }

  addRole(): void {
    const name = this.newRoleName.trim();

    if (name.length < 2) return;

    if (this.drafts().some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      this.toast.error(this.i18n.t('users.roleExists'));
      return;
    }

    this.drafts.update((list) => [...list, { name, isSystem: false, users: 0, permissions: [], isNew: true, picked: new Set<string>() }]);
    this.selected.set(name);
    this.newRoleName = '';
  }

  saveRole(r: RoleDraft): void {
    this.saving.set(true);
    this.adminApi.saveRole({ name: r.name, permissions: [...r.picked], isNew: r.isNew }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();

        // The signed-in user may have changed their own role
        this.auth.refreshAccess().subscribe({ error: () => undefined });
      },
      error: () => this.saving.set(false),
    });
  }

  deleteRole(r: RoleDraft): void {
    if (r.isNew) {
      this.drafts.update((list) => list.filter((x) => x !== r));
      return;
    }

    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.adminApi.deleteRole(r.name).subscribe(() => this.load());
  }
}
