import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import type { UserSettingsSection } from '@core/state/user-settings.state';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserSettingsState } from '@core/state/user-settings.state';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
import { AuraAuthServiceHttp } from '@core/services/http-services/aura-auth-service-http.service';
import { AuthenticationService } from '@core/services/authentication/authentication.service';
import { ToastService } from '@core/components/toast-service';
import type { ChatListItemDto } from '@core/types/aura-chat-service.types';
import { ConfirmDialog } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-user-settings-section',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialog],
  templateUrl: './user-settings-section.html',
  styleUrls: ['./user-settings-section.css'],
})
export class UserSettingsSectionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly authHttp = inject(AuraAuthServiceHttp);
  private readonly authService = inject(AuthenticationService);
  private readonly toast = inject(ToastService);
  readonly store = inject(UserSettingsState);

  readonly section = toSignal(
    this.route.data.pipe(map((d) => d['section'] as UserSettingsSection)),
    { initialValue: this.route.snapshot.data['section'] as UserSettingsSection },
  );

  // ── Cambio de contraseña ────────────────────────────────────────────────────
  readonly changingPassword = signal(false);

  changePassword(): void {
    if (this.changingPassword()) return;
    const { current, new: newPwd, confirm } = this.store.passwordFields();

    if (!current || !newPwd || !confirm) {
      this.toast.show('Completá todos los campos.', 'error');
      return;
    }
    if (newPwd.length < 8) {
      this.toast.show('La nueva contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    if (newPwd !== confirm) {
      this.toast.show('La nueva contraseña y su confirmación no coinciden.', 'error');
      return;
    }

    this.changingPassword.set(true);
    this.authHttp
      .changePassword({ current_password: current, new_password: newPwd })
      .subscribe({
        next: () => {
          this.changingPassword.set(false);
          this.store.resetPasswordForm();
          // El back revoca los refresh tokens al cambiar la contraseña, así que
          // cerramos sesión y mandamos a login.
          this.toast.show('Contraseña actualizada. Iniciá sesión de nuevo.', 'success');
          this.authService.logout().subscribe(() => this.router.navigate(['/login']));
        },
        error: (err: unknown) => {
          this.changingPassword.set(false);
          this.toast.show(this.passwordErrorMessage(err), 'error');
        },
      });
  }

  private passwordErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as
        | { detail?: string; current_password?: string[]; new_password?: string[] }
        | null;
      if (body?.detail) return body.detail;
      if (body?.new_password?.length) return body.new_password[0];
      if (body?.current_password?.length) return body.current_password[0];
    }
    return 'No se pudo cambiar la contraseña.';
  }

  // ── Control de datos: chats archivados ──────────────────────────────────────
  readonly showArchived = signal(false);
  readonly loadingArchived = signal(false);
  readonly archivedChats = signal<ChatListItemDto[]>([]);
  readonly unarchivingId = signal<number | null>(null);
  readonly archivingAll = signal(false);
  readonly confirmArchiveAllOpen = signal(false);
  readonly deletingAll = signal(false);
  readonly confirmDeleteAllOpen = signal(false);

  openArchived(): void {
    this.showArchived.set(true);
    this.loadArchived();
  }

  closeArchived(): void {
    this.showArchived.set(false);
  }

  private loadArchived(): void {
    this.loadingArchived.set(true);
    this.chatHttp.listArchivedChats().subscribe({
      next: (page) => {
        this.archivedChats.set([...page.results]);
        this.loadingArchived.set(false);
      },
      error: () => {
        this.loadingArchived.set(false);
        this.toast.show('No se pudieron cargar los chats archivados.', 'error');
      },
    });
  }

  unarchive(chat: ChatListItemDto): void {
    if (this.unarchivingId() != null) return;
    this.unarchivingId.set(chat.id);
    this.chatHttp.unarchiveChats({ ids: [chat.id] }).subscribe({
      next: () => {
        this.archivedChats.update((list) => list.filter((c) => c.id !== chat.id));
        this.unarchivingId.set(null);
        this.toast.show('Chat desarchivado.', 'success');
      },
      error: () => {
        this.unarchivingId.set(null);
        this.toast.show('No se pudo desarchivar el chat.', 'error');
      },
    });
  }

  archiveAll(): void {
    if (this.archivingAll()) return;
    this.confirmArchiveAllOpen.set(true);
  }

  cancelArchiveAll(): void {
    this.confirmArchiveAllOpen.set(false);
  }

  confirmArchiveAll(): void {
    this.confirmArchiveAllOpen.set(false);
    if (this.archivingAll()) return;
    this.archivingAll.set(true);
    // No hay endpoint "archivar todo": juntamos los IDs de todas las páginas de
    // chats activos siguiendo la paginación y los archivamos en una sola llamada.
    this.chatHttp
      .listChats()
      .pipe(
        expand((page) => (page.next ? this.chatHttp.listChats({ url: page.next }) : EMPTY)),
        reduce((ids, page) => ids.concat(page.results.map((c) => c.id)), [] as number[]),
      )
      .subscribe({
        next: (ids) => {
          if (ids.length === 0) {
            this.archivingAll.set(false);
            this.toast.show('No hay chats para archivar.', 'success');
            return;
          }
          this.chatHttp.archiveChats({ ids }).subscribe({
            next: (res) => {
              this.archivingAll.set(false);
              this.toast.show(`${res.archived} chat(s) archivado(s).`, 'success');
              if (this.showArchived()) this.loadArchived();
            },
            error: () => {
              this.archivingAll.set(false);
              this.toast.show('No se pudieron archivar los chats.', 'error');
            },
          });
        },
        error: () => {
          this.archivingAll.set(false);
          this.toast.show('No se pudieron obtener los chats.', 'error');
        },
      });
  }

  deleteAll(): void {
    if (this.deletingAll()) return;
    this.confirmDeleteAllOpen.set(true);
  }

  cancelDeleteAll(): void {
    this.confirmDeleteAllOpen.set(false);
  }

  confirmDeleteAll(): void {
    this.confirmDeleteAllOpen.set(false);
    if (this.deletingAll()) return;
    this.deletingAll.set(true);
    // Mismo patrón que "archivar todo": juntamos los IDs de todos los chats del
    // usuario (membresía) paginando y los eliminamos en una sola llamada. El back
    // solo borra los chats de los que el usuario es dueño; el resto los omite.
    this.chatHttp
      .listChats()
      .pipe(
        expand((page) => (page.next ? this.chatHttp.listChats({ url: page.next }) : EMPTY)),
        reduce((ids, page) => ids.concat(page.results.map((c) => c.id)), [] as number[]),
      )
      .subscribe({
        next: (ids) => {
          if (ids.length === 0) {
            this.deletingAll.set(false);
            this.toast.show('No hay chats para eliminar.', 'success');
            return;
          }
          this.chatHttp.deleteChats({ ids }).subscribe({
            next: (res) => {
              this.deletingAll.set(false);
              this.toast.show(`${res.deleted} chat(s) eliminado(s).`, 'success');
              if (this.showArchived()) this.loadArchived();
            },
            error: () => {
              this.deletingAll.set(false);
              this.toast.show('No se pudieron eliminar los chats.', 'error');
            },
          });
        },
        error: () => {
          this.deletingAll.set(false);
          this.toast.show('No se pudieron obtener los chats.', 'error');
        },
      });
  }
}
