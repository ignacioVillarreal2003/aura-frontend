import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { ToastService } from '@core/components/toast-service';
import type { MembershipDto } from '@aura-types/aura-chat-service.types';

@Component({
  selector: 'app-user-invitations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-invitations.html',
  styleUrl: './user-invitations.css',
})
export class UserInvitations implements OnInit {
  private readonly http = inject(AuraChatServiceHttp);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly memberships = signal<MembershipDto[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<'pending' | 'all'>('pending');
  readonly actioningId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  setFilter(f: 'pending' | 'all'): void {
    if (this.filter() === f) return;
    this.filter.set(f);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const query = this.filter() === 'pending' ? { status: 'pending', page_size: 50 } : { page_size: 50 };
    this.http.listMyMemberships(query).pipe(take(1)).subscribe({
      next: (page) => {
        this.memberships.set([...page.results]);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('No se pudieron cargar las invitaciones.', 'error');
        this.loading.set(false);
      },
    });
  }

  accept(m: MembershipDto): void {
    this.actioningId.set(m.id);
    this.http.patchMember(m.chat_id, m.member_id, { status: 'active' }).pipe(take(1)).subscribe({
      next: () => {
        this.toast.show(`Invitación a "${m.chat_name}" aceptada. Abriendo chat…`, 'success');
        void this.router.navigate(['/main-container', 'chat', m.chat_id]);
      },
      error: () => {
        this.toast.show('No se pudo aceptar la invitación.', 'error');
        this.actioningId.set(null);
      },
    });
  }

  decline(m: MembershipDto): void {
    this.actioningId.set(m.id);
    this.http.patchMember(m.chat_id, m.member_id, { status: 'inactive' }).pipe(take(1)).subscribe({
      next: () => {
        this.toast.show('Invitación rechazada.', 'success');
        this.actioningId.set(null);
        this.memberships.update((list) =>
          list.map((i) => i.id === m.id ? { ...i, status: 'inactive' } : i),
        );
        if (this.filter() === 'pending') {
          this.memberships.update((list) => list.filter((i) => i.id !== m.id));
        }
      },
      error: () => {
        this.toast.show('No se pudo rechazar la invitación.', 'error');
        this.actioningId.set(null);
      },
    });
  }

  goToChat(chatId: number): void {
    void this.router.navigate(['/main-container', 'chat', chatId]);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'pending':  return 'Pendiente';
      case 'active':   return 'Activo';
      case 'inactive': return 'Inactivo';
      default:         return status;
    }
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'owner':  return 'Propietario';
      case 'editor': return 'Editor';
      case 'reader': return 'Lector';
      default:       return role;
    }
  }
}
