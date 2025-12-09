import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Modal } from '../../../../shared/components/modals/modal/modal';
import { GroupChat } from '../../../../core/services/group-chat.service';

@Component({
  selector: 'app-group-chat-link-modal',
  standalone: true,
  imports: [CommonModule, Modal],
  templateUrl: './group-chat-link-modal.component.html',
  styleUrls: ['./group-chat-link-modal.component.css']
})
export class GroupChatLinkModalComponent {
  @Input() shareLink: string = '';
  @Input() groupChat: GroupChat | null = null;
  @Output() onClose = new EventEmitter<void>();

  linkCopied = false;

  close(): void {
    this.onClose.emit();
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareLink).then(() => {
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 2000);
    }).catch(err => {
      console.error('Error al copiar el enlace:', err);
    });
  }
}


