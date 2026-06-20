import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import type { UserSettingsSection } from '@core/state/user-settings.state';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserSettingsState } from '@core/state/user-settings.state';
import { AuraChatServiceHttp } from '@core/services/http-services/aura-chat-service-http.service';
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
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly toast = inject(ToastService);
  readonly store = inject(UserSettingsState);

  readonly section = toSignal(
    this.route.data.pipe(map((d) => d['section'] as UserSettingsSection)),
    { initialValue: this.route.snapshot.data['section'] as UserSettingsSection },
  );

  // ── Control de datos: chats archivados ──────────────────────────────────────
  readonly showArchived = signal(false);
  readonly loadingArchived = signal(false);
  readonly archivedChats = signal<ChatListItemDto[]>([]);
  readonly unarchivingId = signal<number | null>(null);
  readonly archivingAll = signal(false);
  readonly confirmArchiveAllOpen = signal(false);

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
}
