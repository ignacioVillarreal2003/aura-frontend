import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatModeService } from '../../../../core/services/chat-mode.service';

@Component({
  selector: 'app-new-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-chat.component.html',
  styleUrls: ['./new-chat.component.css']
})
export class NewChatComponent {
  private chatModeService = inject(ChatModeService);
  
  get chatMode() {
    return this.chatModeService.chatMode();
  }
  
  groupName = signal('');
  searchQuery = signal('');
  selectedMembers = signal<string[]>([]);
  searchResults = signal<string[]>([]);
  groupCreated = signal(false);
  createdGroupName = signal('');

  // Simulación de usuarios disponibles
  availableUsers = [
    'Alex Chen', 'Sofia Rodriguez', 'Marcus Johnson', 'Elena Petrov', 'David Kim', 'Isabella Santos', 
    'Oliver Thompson', 'Luna Zhang', 'Gabriel Silva', 'Aria Patel', 'Finn O\'Connor', 'Maya Kumar'
  ];

  onSearchUsers() {
    const query = this.searchQuery().toLowerCase();
    if (query.length > 0) {
      const filtered = this.availableUsers.filter(user => 
        user.toLowerCase().includes(query) && 
        !this.selectedMembers().includes(user)
      );
      this.searchResults.set(filtered);
    } else {
      this.searchResults.set([]);
    }
  }

  onSelectUser(user: string) {
    if (!this.selectedMembers().includes(user)) {
      this.selectedMembers.set([...this.selectedMembers(), user]);
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  onRemoveMember(member: string) {
    this.selectedMembers.set(
      this.selectedMembers().filter(m => m !== member)
    );
  }

  onCreateGroup() {
    if (this.groupName().trim() && this.selectedMembers().length > 0) {
      console.log('Creando grupo:', {
        name: this.groupName(),
        members: this.selectedMembers()
      });
      
      // Simular creación exitosa del grupo
      this.createdGroupName.set(this.groupName());
      this.groupCreated.set(true);
      
      // Limpiar formulario
      this.groupName.set('');
      this.selectedMembers.set([]);
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  onCreateNewGroup() {
    this.groupCreated.set(false);
    this.createdGroupName.set('');
  }
}
