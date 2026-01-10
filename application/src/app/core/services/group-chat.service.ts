import { Injectable, signal } from '@angular/core';

export interface GroupChat {
  id: string;
  title: string;
  linkId: string; // ID único para el enlace
  createdBy: string;
  createdAt: Date;
  members: string[]; // emails de los miembros
  memberNames?: { [email: string]: string }; // nombres de los miembros
}

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private groupChats = signal<GroupChat[]>([]);
  private currentGroupChat = signal<GroupChat | null>(null);

  constructor() {
    // Cargar chats grupales del localStorage si existen
    this.loadGroupChatsFromStorage();
  }

  /**
   * Crea un nuevo chat grupal
   */
  createGroupChat(creatorEmail: string, creatorName: string): GroupChat {
    const linkId = this.generateLinkId();
    const groupChat: GroupChat = {
      id: this.generateUniqueId(),
      title: 'Nuevo chat grupal',
      linkId: linkId,
      createdBy: creatorEmail,
      createdAt: new Date(),
      members: [creatorEmail],
      memberNames: { [creatorEmail]: creatorName }
    };

    this.groupChats.update(chats => [...chats, groupChat]);
    this.saveGroupChatsToStorage();
    return groupChat;
  }

  /**
   * Genera el enlace completo para compartir
   */
  getShareLink(groupChat: GroupChat): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join-group/${groupChat.linkId}`;
  }

  /**
   * Obtiene un chat grupal por su linkId
   */
  getGroupChatByLinkId(linkId: string): GroupChat | null {
    return this.groupChats().find(chat => chat.linkId === linkId) ?? null;
  }

  /**
   * Une a un usuario a un chat grupal
   */
  joinGroupChat(linkId: string, userEmail: string, userName: string): GroupChat | null {
    const groupChat = this.getGroupChatByLinkId(linkId);
    
    if (!groupChat) {
      return null;
    }

    // Si el usuario ya es miembro, solo devolver el chat
    if (groupChat.members.includes(userEmail)) {
      return groupChat;
    }

    // Agregar el nuevo miembro
    groupChat.members.push(userEmail);
    if (groupChat.memberNames) {
      groupChat.memberNames[userEmail] = userName;
    } else {
      groupChat.memberNames = { [userEmail]: userName };
    }

    this.saveGroupChatsToStorage();
    return groupChat;
  }

  /**
   * Obtiene todos los chats grupales del usuario actual
   */
  getUserGroupChats(userEmail: string): GroupChat[] {
    return this.groupChats().filter(chat => 
      chat.members.includes(userEmail)
    );
  }

  /**
   * Obtiene un chat grupal por su ID
   */
  getGroupChatById(id: string): GroupChat | null {
    return this.groupChats().find(chat => chat.id === id) ?? null;
  }

  /**
   * Actualiza el título de un chat grupal
   */
  updateGroupChatTitle(id: string, newTitle: string): void {
    this.groupChats.update(chats => 
      chats.map(chat => 
        chat.id === id ? { ...chat, title: newTitle } : chat
      )
    );
    this.saveGroupChatsToStorage();
  }

  /**
   * Elimina un chat grupal
   */
  deleteGroupChat(id: string): void {
    this.groupChats.update(chats => 
      chats.filter(chat => chat.id !== id)
    );
    this.saveGroupChatsToStorage();
  }

  /**
   * Abandona un chat grupal
   */
  leaveGroupChat(chatId: string, userEmail: string): void {
    const chat = this.getGroupChatById(chatId);
    if (!chat) return;

    chat.members = chat.members.filter(email => email !== userEmail);
    
    // Si no quedan miembros, eliminar el chat
    if (chat.members.length === 0) {
      this.deleteGroupChat(chatId);
    } else {
      this.saveGroupChatsToStorage();
    }
  }

  /**
   * Establece el chat grupal actual
   */
  setCurrentGroupChat(chat: GroupChat | null): void {
    this.currentGroupChat.set(chat);
  }

  /**
   * Obtiene el chat grupal actual
   */
  getCurrentGroupChat(): GroupChat | null {
    return this.currentGroupChat();
  }

  // Métodos privados

  private generateUniqueId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateLinkId(): string {
    // Genera un ID más corto y legible para el enlace
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private saveGroupChatsToStorage(): void {
    try {
      localStorage.setItem('aura_group_chats', JSON.stringify(this.groupChats()));
    } catch (error) {
      console.error('Error guardando chats grupales:', error);
    }
  }

  private loadGroupChatsFromStorage(): void {
    try {
      const stored = localStorage.getItem('aura_group_chats');
      if (stored) {
        const chats = JSON.parse(stored) as GroupChat[];
        // Convertir las fechas de string a Date
        chats.forEach(chat => {
          chat.createdAt = new Date(chat.createdAt);
        });
        this.groupChats.set(chats);
      }
    } catch (error) {
      console.error('Error cargando chats grupales:', error);
    }
  }
}

