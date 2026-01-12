import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private chats = signal<Chat[]>([]);
  private currentChat = signal<Chat | null>(null);

  constructor() {
    this.loadChatsFromStorage();
    if (this.chats().length === 0) {
      this.initializeMockChats();
    }
  }

  private initializeMockChats(): void {
    const mockChats: Chat[] = [
      {
        id: '101',
        title: 'Ithaka flow',
        createdAt: new Date('2025-01-08'),
        updatedAt: new Date('2025-01-08'),
        messages: [
          { id: 'm1', chatId: '101', sender: 'user', content: 'Hola, necesito ayuda con el flujo de Ithaka', timestamp: new Date('2025-01-08T10:00:00') },
          { id: 'm2', chatId: '101', sender: 'assistant', content: '¡Hola! Claro, estaré encantado de ayudarte con el flujo de Ithaka. ¿Qué aspecto específico necesitas resolver?', timestamp: new Date('2025-01-08T10:00:30') }
        ]
      },
      {
        id: '102',
        title: 'Notas BCP',
        createdAt: new Date('2025-01-07'),
        updatedAt: new Date('2025-01-07'),
        messages: [
          { id: 'm3', chatId: '102', sender: 'user', content: 'Necesito organizar las notas del proyecto BCP', timestamp: new Date('2025-01-07T14:00:00') },
          { id: 'm4', chatId: '102', sender: 'assistant', content: 'Perfecto, te ayudo a organizar las notas del proyecto BCP. ¿Cuáles son los puntos principales que necesitas documentar?', timestamp: new Date('2025-01-07T14:00:30') }
        ]
      },
      {
        id: '103',
        title: 'Proyecto React Dashboard',
        createdAt: new Date('2025-01-06'),
        updatedAt: new Date('2025-01-06'),
        messages: []
      },
      {
        id: '104',
        title: 'API REST con Node.js',
        createdAt: new Date('2025-01-05'),
        updatedAt: new Date('2025-01-05'),
        messages: []
      },
      {
        id: '105',
        title: 'Diseño UI/UX para mobile',
        createdAt: new Date('2025-01-04'),
        updatedAt: new Date('2025-01-04'),
        messages: []
      },
      {
        id: '106',
        title: 'Base de datos PostgreSQL',
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
        messages: []
      },
      {
        id: '107',
        title: 'Configuración Docker',
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        messages: []
      },
      {
        id: '108',
        title: 'Testing con Jest y Cypress',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        messages: []
      },
      {
        id: '109',
        title: 'Deploy en AWS',
        createdAt: new Date('2024-12-30'),
        updatedAt: new Date('2024-12-30'),
        messages: []
      },
      {
        id: '110',
        title: 'Optimización de performance',
        createdAt: new Date('2024-12-29'),
        updatedAt: new Date('2024-12-29'),
        messages: []
      },
      {
        id: '111',
        title: 'Integración con Stripe',
        createdAt: new Date('2024-12-28'),
        updatedAt: new Date('2024-12-28'),
        messages: []
      },
      {
        id: '112',
        title: 'Sistema de autenticación',
        createdAt: new Date('2024-12-27'),
        updatedAt: new Date('2024-12-27'),
        messages: []
      },
      {
        id: '113',
        title: 'Microservicios con Kubernetes',
        createdAt: new Date('2024-12-26'),
        updatedAt: new Date('2024-12-26'),
        messages: []
      },
      {
        id: '114',
        title: 'Machine Learning con Python',
        createdAt: new Date('2024-12-25'),
        updatedAt: new Date('2024-12-25'),
        messages: []
      },
      {
        id: '115',
        title: 'GraphQL y Apollo',
        createdAt: new Date('2024-12-24'),
        updatedAt: new Date('2024-12-24'),
        messages: []
      },
      {
        id: '116',
        title: 'PWA con Service Workers',
        createdAt: new Date('2024-12-23'),
        updatedAt: new Date('2024-12-23'),
        messages: []
      }
    ];
    this.chats.set(mockChats);
    this.saveChatsToStorage();
  }

  createChat(initialMessage?: string): Chat {
    const chat: Chat = {
      id: this.generateUniqueId(),
      title: initialMessage ? this.generateTitle(initialMessage) : 'Nuevo chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };

    if (initialMessage) {
      chat.messages.push({
        id: this.generateUniqueId(),
        chatId: chat.id,
        sender: 'user',
        content: initialMessage,
        timestamp: new Date()
      });
    }

    this.chats.update(chats => [chat, ...chats]);
    this.saveChatsToStorage();
    return chat;
  }

  getChatById(id: string): Chat | null {
    return this.chats().find(chat => chat.id === id) ?? null;
  }

  getAllChats(): Chat[] {
    return this.chats();
  }

  addMessage(chatId: string, content: string, sender: 'user' | 'assistant'): ChatMessage | null {
    const chat = this.getChatById(chatId);
    if (!chat) return null;

    const message: ChatMessage = {
      id: this.generateUniqueId(),
      chatId,
      sender,
      content,
      timestamp: new Date()
    };

    this.chats.update(chats =>
      chats.map(c => {
        if (c.id === chatId) {
          const updatedChat = {
            ...c,
            messages: [...c.messages, message],
            updatedAt: new Date()
          };
          if (c.messages.length === 0 && sender === 'user') {
            updatedChat.title = this.generateTitle(content);
          }
          return updatedChat;
        }
        return c;
      })
    );

    this.saveChatsToStorage();
    return message;
  }

  updateChatTitle(id: string, newTitle: string): void {
    this.chats.update(chats =>
      chats.map(chat =>
        chat.id === id ? { ...chat, title: newTitle, updatedAt: new Date() } : chat
      )
    );
    this.saveChatsToStorage();
  }

  deleteChat(id: string): void {
    this.chats.update(chats => chats.filter(chat => chat.id !== id));
    this.saveChatsToStorage();
  }

  setCurrentChat(chat: Chat | null): void {
    this.currentChat.set(chat);
  }

  getCurrentChat(): Chat | null {
    return this.currentChat();
  }

  private generateUniqueId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTitle(content: string): string {
    const maxLength = 40;
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  private saveChatsToStorage(): void {
    try {
      localStorage.setItem('aura_chats', JSON.stringify(this.chats()));
    } catch (error) {
      console.error('Error guardando chats:', error);
    }
  }

  private loadChatsFromStorage(): void {
    try {
      const stored = localStorage.getItem('aura_chats');
      if (stored) {
        const chats = JSON.parse(stored) as Chat[];
        chats.forEach(chat => {
          chat.createdAt = new Date(chat.createdAt);
          chat.updatedAt = new Date(chat.updatedAt);
          chat.messages.forEach(msg => {
            msg.timestamp = new Date(msg.timestamp);
          });
        });
        this.chats.set(chats);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
    }
  }
}

