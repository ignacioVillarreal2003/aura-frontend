import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { AuraChatServiceHttp } from '../../../../core/services/http-services/aura-chat-service-http.service';
import { UserState } from '../../../../core/state/user.state';
import type { AssistantAdminDto, AssistantDto } from '../../../../core/types/aura-chat-service.types';

const PERM_CREATE = 'CREATE_ASSISTANT';
const PERM_UPDATE = 'UPDATE_ASSISTANT';
const PERM_DELETE = 'DELETE_ASSISTANT';
const PERM_MANAGE = 'MANAGE_ASSISTANTS';

const DEFAULT_EMOJIS = ['🤖', '✈️', '🎖️', '📡', '🛡️', '🗺️', '⚡', '🔍', '📋', '🧭'];

@Component({
  selector: 'app-asistentes-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './asistentes-hub.component.html',
  styleUrl: './asistentes-hub.component.css',
})
export class AsistentesHubComponent implements OnInit {
  private readonly chatHttp = inject(AuraChatServiceHttp);
  private readonly userState = inject(UserState);
  private readonly router = inject(Router);

  readonly defaultEmojis = DEFAULT_EMOJIS;

  // Permission checks
  readonly canCreate = computed(() =>
    this.userState.user()?.permissions.includes(PERM_CREATE) ?? false
  );
  readonly canUpdate = computed(() =>
    this.userState.user()?.permissions.includes(PERM_UPDATE) ?? false
  );
  readonly canDelete = computed(() =>
    this.userState.user()?.permissions.includes(PERM_DELETE) ?? false
  );
  readonly canManage = computed(() =>
    this.userState.user()?.permissions.includes(PERM_MANAGE) ?? false
  );
  readonly isAdmin = computed(() => this.canCreate() || this.canManage());

  // State
  readonly assistants = signal<AssistantAdminDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Start-chat state: keyed by assistant id
  readonly startingId = signal<number | null>(null);

  // Panel state (create/edit form)
  readonly panelOpen = signal(false);
  readonly panelMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<number | null>(null);

  // Form fields
  readonly formName = signal('');
  readonly formDescription = signal('');
  readonly formSystemPrompt = signal('');
  readonly formEmoji = signal('🤖');
  readonly formActive = signal(true);
  readonly formLoading = signal(false);
  readonly formError = signal<string | null>(null);

  // Delete confirm
  readonly confirmDeleteId = signal<number | null>(null);
  readonly deleteLoading = signal(false);

  readonly formValid = computed(
    () => this.formName().trim().length > 0 && this.formSystemPrompt().trim().length > 0
  );

  ngOnInit(): void {
    this._loadAssistants();
  }

  private _loadAssistants(): void {
    this.loading.set(true);
    this.error.set(null);

    const request$ = this.canManage()
      ? this.chatHttp.listAssistantsAdmin({ page_size: 100 })
      : this.chatHttp.listAssistants({ page_size: 100 });

    request$.subscribe({
      next: (page) => {
        this.loading.set(false);
        this.assistants.set(page.results as AssistantAdminDto[]);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar los asistentes.');
      },
    });
  }

  startChat(assistant: AssistantDto): void {
    this.startingId.set(assistant.id);
    this.error.set(null);
    this.chatHttp.startAssistantChat(assistant.id).subscribe({
      next: (resp) => {
        this.startingId.set(null);
        this.router.navigate(['/main-container/chat', resp.chat_id]);
      },
      error: () => {
        this.startingId.set(null);
        this.error.set(`No se pudo iniciar la sesión con "${assistant.name}".`);
      },
    });
  }

  openCreatePanel(): void {
    this.panelMode.set('create');
    this.editingId.set(null);
    this.formName.set('');
    this.formDescription.set('');
    this.formSystemPrompt.set('');
    this.formEmoji.set('🤖');
    this.formActive.set(true);
    this.formError.set(null);
    this.panelOpen.set(true);
  }

  openEditPanel(assistant: AssistantAdminDto): void {
    this.panelMode.set('edit');
    this.editingId.set(assistant.id);
    this.formName.set(assistant.name);
    this.formDescription.set(assistant.description ?? '');
    this.formSystemPrompt.set(assistant.system_prompt ?? '');
    this.formEmoji.set(assistant.avatar_emoji || '🤖');
    this.formActive.set(assistant.is_active);
    this.formError.set(null);
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  setEmoji(emoji: string): void {
    this.formEmoji.set(emoji);
  }

  submitForm(): void {
    if (!this.formValid()) return;
    this.formLoading.set(true);
    this.formError.set(null);

    const body = {
      name: this.formName().trim(),
      description: this.formDescription().trim(),
      system_prompt: this.formSystemPrompt().trim(),
      avatar_emoji: this.formEmoji(),
      is_active: this.formActive(),
    };

    const mode = this.panelMode();
    const editId = this.editingId();

    const request$ =
      mode === 'create'
        ? this.chatHttp.createAssistant(body)
        : this.chatHttp.patchAssistant(editId!, body);

    request$.subscribe({
      next: (saved) => {
        this.formLoading.set(false);
        this.panelOpen.set(false);
        if (mode === 'create') {
          this.assistants.update((list) => [saved, ...list]);
        } else {
          this.assistants.update((list) =>
            list.map((a) => (a.id === saved.id ? saved : a))
          );
        }
      },
      error: () => {
        this.formLoading.set(false);
        this.formError.set('No se pudo guardar el asistente.');
      },
    });
  }

  requestDelete(assistantId: number): void {
    this.confirmDeleteId.set(assistantId);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(assistantId: number): void {
    this.deleteLoading.set(true);
    this.chatHttp.deleteAssistant(assistantId).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.confirmDeleteId.set(null);
        this.assistants.update((list) => list.filter((a) => a.id !== assistantId));
      },
      error: () => {
        this.deleteLoading.set(false);
        this.error.set('No se pudo eliminar el asistente.');
      },
    });
  }

  toggleActive(assistant: AssistantAdminDto): void {
    this.chatHttp.patchAssistant(assistant.id, { is_active: !assistant.is_active }).subscribe({
      next: (updated) => {
        this.assistants.update((list) =>
          list.map((a) => (a.id === updated.id ? updated : a))
        );
      },
      error: () => {
        this.error.set('No se pudo cambiar el estado del asistente.');
      },
    });
  }

  autosizeTextarea(el: HTMLTextAreaElement, maxPx = 400): void {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
  }
}
