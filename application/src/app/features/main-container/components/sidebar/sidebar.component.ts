import { Component, EventEmitter, Input, Output, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BtnIcon } from '../../../../shared/components/buttons/btn-icon/btn-icon';
import { GroupChatService } from '../../../../core/services/group-chat.service';

type ChatRow = { id: string; title: string; route: string; isGroup?: boolean };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, BtnIcon],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent implements OnInit {
  private groupChatService = inject(GroupChatService);
  @Input() collapsed = false;
  @Input() activeId: string | null = null;

  @Input() userEmailInput = 'usuario@ejemplo.com';
  @Input() userNameInput = 'Emiliano Fau';
  @Input() userRolInput = 'Operador';

  @Output() toggle = new EventEmitter<boolean>();
  @Output() select = new EventEmitter<string>();
  @Output() newClick = new EventEmitter<void>();
  @Output() newGroupChatClick = new EventEmitter<void>();
  @Output() chatAction = new EventEmitter<{chatId: string, action: string}>();

  individualChats: ChatRow[] = [
    { id: '101', title: 'Consulta sobre epidemotitis aguda de tercer grado', route: '/chat/101', isGroup: false },
    { id: '102', title: 'AURA – tesis', route: '/chat/102', isGroup: false },
    { id: '103', title: 'Ithaka flow', route: '/chat/103', isGroup: false },
    { id: '104', title: 'Notas BCP', route: '/chat/104', isGroup: false },
    { id: '105', title: 'Proyecto React Dashboard', route: '/chat/105', isGroup: false },
    { id: '106', title: 'API REST con Node.js', route: '/chat/106', isGroup: false },
    { id: '107', title: 'Diseño UI/UX para mobile', route: '/chat/107', isGroup: false },
    { id: '108', title: 'Base de datos PostgreSQL', route: '/chat/108', isGroup: false },
    { id: '109', title: 'Configuración Docker', route: '/chat/109', isGroup: false },
    { id: '110', title: 'Testing con Jest y Cypress', route: '/chat/110', isGroup: false },
    { id: '111', title: 'Deploy en AWS', route: '/chat/111', isGroup: false },
    { id: '112', title: 'Optimización de performance', route: '/chat/112', isGroup: false },
    { id: '113', title: 'Integración con Stripe', route: '/chat/113', isGroup: false },
    { id: '114', title: 'Sistema de autenticación', route: '/chat/114', isGroup: false },
    { id: '115', title: 'Microservicios con Kubernetes', route: '/chat/115', isGroup: false },
    { id: '116', title: 'Machine Learning con Python', route: '/chat/116', isGroup: false },
    { id: '117', title: 'GraphQL y Apollo', route: '/chat/117', isGroup: false },
    { id: '118', title: 'PWA con Service Workers', route: '/chat/118', isGroup: false },
  ];

  groupChats: ChatRow[] = [];
  
  chats: ChatRow[] = [];

  // Estado para el menú de opciones
  hoveredChatId = signal<string | null>(null);
  showChatMenu = signal<string | null>(null);
  menuPosition = signal<{x: number, y: number}>({x: 0, y: 0});
  visibleChats = signal<string[]>([]);

  ngOnInit(): void {
    this.loadAllChats();
  }

  loadAllChats(): void {
    const userEmail = 'usuario@ejemplo.com'; // TODO: Obtener del AuthService
    const userGroupChats = this.groupChatService.getUserGroupChats(userEmail);
    
    this.groupChats = userGroupChats.map(gc => ({
      id: gc.id,
      title: gc.title,
      route: `/main-container/group-chat/${gc.id}`,
      isGroup: true
    }));

    // Combinar chats individuales y grupales
    this.chats = [...this.groupChats, ...this.individualChats];
  }

  isOpen() { return !this.collapsed; }
  onOpenClose() { this.toggle.emit(!this.collapsed); }

  onMainClick(evt: MouseEvent) {
    if (!this.isOpen()) {
      evt.preventDefault();
      this.onOpenClose();
    } else {
      this.emitSelect('main');
    }
  }

  emitSelect(id: string) { this.select.emit(id); }
  emitNewClick() { this.newClick.emit(); }
  emitNewGroupChatClick() { 
    this.newGroupChatClick.emit(); 
  }

  userInitials() {
    const n = this.userNameInput?.trim?.() || 'U';
    return n.charAt(0).toUpperCase();
  }

  userName() { return this.userNameInput; }
  userRol() { return this.userRolInput; }

  // Métodos para el manejo del menú de opciones
  onChatMouseEnter(chatId: string) {
    if (this.isOpen()) {
      this.hoveredChatId.set(chatId);
    }
  }

  onChatMouseLeave() {
    this.hoveredChatId.set(null);
  }

  onChatOptionsClick(event: MouseEvent, chatId: string) {
    event.stopPropagation();
    
    // Si ya está abierto este menú, cerrarlo; si no, abrirlo
    if (this.showChatMenu() === chatId) {
      this.showChatMenu.set(null);
    } else {
      // Calcular posición del menú
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Determinar si debe aparecer arriba o abajo
      const shouldShowAbove = this.shouldShowMenuAbove(chatId);
      
      const x = rect.left; // Empieza exactamente donde comienza el botón
      const y = shouldShowAbove ? rect.top - 190 : rect.bottom + 12; // Arriba a 190px o abajo
      
      this.menuPosition.set({ x, y });
      this.showChatMenu.set(chatId);
    }
  }

  shouldShowMenuAbove(chatId: string): boolean {
    // Obtener todos los chats visibles
    const chatsList = document.querySelector('.chats-list');
    if (!chatsList) return false;

    const chatElements = chatsList.querySelectorAll('.chat-row');
    const visibleChats: string[] = [];
    
    chatElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const listRect = chatsList.getBoundingClientRect();
      
      // Verificar si el chat está visible dentro del contenedor
      if (rect.top >= listRect.top && rect.bottom <= listRect.bottom) {
        const chatRow = element as HTMLElement;
        const chatIdAttr = chatRow.getAttribute('data-chat-id');
        if (chatIdAttr) {
          visibleChats.push(chatIdAttr);
        }
      }
    });

    // Si hay 4 o menos chats visibles, no mostrar arriba
    if (visibleChats.length <= 4) return false;

    // Obtener los últimos 4 chats visibles
    const lastFourVisibleChats = visibleChats.slice(-4);
    
    // Si el chat actual está en los últimos 4, mostrar arriba
    return lastFourVisibleChats.includes(chatId);
  }

  onCloseChatMenu() {
    this.showChatMenu.set(null);
  }

  onChatActionSelected(data: {chatId: string, action: string}) {
    this.chatAction.emit(data);
    this.onCloseChatMenu();
  }

  getChatTitle(chatId: string): string {
    return this.chats.find(c => c.id === chatId)?.title || '';
  }
}
