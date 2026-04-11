import { Injectable, signal } from '@angular/core';
import type { ChatType } from '@core/models/types/chat.types';

/**
 * Vista UI del mismo recurso `chat` que un chat individual: en BD los miembros viven en
 * `chat_membership`; aquí guardamos emails/nombres hasta enlazar con IDs de usuario.
 */
export interface GroupChat {
  id: string;
  title: string;
  members: string[];
  memberNames: Record<string, string>;
  /** Id used in invite / join URLs. */
  linkId: string;
  createdAt: Date;
  /** Siempre `group` — misma tabla `chat`, distinto tipo y más participantes. */
  chatType: ChatType;
  backendChatId?: number;
}

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private readonly groupChats = signal<GroupChat[]>(seedGroupChats());
  private readonly currentGroupChat = signal<GroupChat | null>(null);

  getGroupChatById(id: string): GroupChat | undefined {
    return this.groupChats().find((g) => g.id === id);
  }

  getGroupChatByLinkId(linkId: string): GroupChat | null {
    return this.groupChats().find((g) => g.linkId === linkId) ?? null;
  }

  getUserGroupChats(userEmail: string): GroupChat[] {
    return this.groupChats().filter((g) => g.members.includes(userEmail));
  }

  getShareLink(groupChat: GroupChat): string {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    return `${base}/join-group/${groupChat.linkId}`;
  }

  createGroupChat(creatorEmail: string, creatorName: string): GroupChat {
    const id = `g-${Date.now()}`;
    const linkId = `link-${Math.random().toString(36).slice(2, 10)}`;
    const group: GroupChat = {
      id,
      title: `Grupo de ${creatorName}`,
      members: [creatorEmail],
      memberNames: { [creatorEmail]: creatorName },
      linkId,
      createdAt: new Date(),
      chatType: 'group',
    };
    this.groupChats.update((list) => [...list, group]);
    return group;
  }

  joinGroupChat(
    linkId: string,
    userEmail: string,
    userName: string
  ): GroupChat | null {
    const idx = this.groupChats().findIndex((g) => g.linkId === linkId);
    if (idx < 0) {
      return null;
    }
    let updated: GroupChat | null = null;
    this.groupChats.update((list) => {
      const next = [...list];
      const g = next[idx];
      if (g.members.includes(userEmail)) {
        updated = g;
        return next;
      }
      const merged: GroupChat = {
        ...g,
        members: [...g.members, userEmail],
        memberNames: { ...g.memberNames, [userEmail]: userName },
      };
      next[idx] = merged;
      updated = merged;
      return next;
    });
    return updated;
  }

  deleteGroupChat(id: string): void {
    this.groupChats.update((list) => list.filter((g) => g.id !== id));
    if (this.currentGroupChat()?.id === id) {
      this.currentGroupChat.set(null);
    }
  }

  setCurrentGroupChat(chat: GroupChat | null): void {
    this.currentGroupChat.set(chat);
  }

  getCurrentGroupChat(): GroupChat | null {
    return this.currentGroupChat();
  }
}

function seedGroupChats(): GroupChat[] {
  const demoLink = 'demo-invite-001';
  return [
    {
      id: '201',
      title: 'Equipo documentación',
      members: ['usuario@ejemplo.com', 'admin@ejemplo.com'],
      memberNames: {
        'usuario@ejemplo.com': 'Usuario Ejemplo',
        'admin@ejemplo.com': 'Admin',
      },
      linkId: demoLink,
      createdAt: new Date('2025-01-05T12:00:00'),
      chatType: 'group',
    },
  ];
}
