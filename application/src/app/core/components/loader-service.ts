import {Injectable, inject, signal, WritableSignal} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {Loader} from '../../shared/components/loaders/loader/loader';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private readonly overlay = inject(Overlay);
  private overlayRef: OverlayRef | null = null;
  private readonly _loading: WritableSignal<boolean> = signal(false);

  get loading(): WritableSignal<boolean> {
    return this._loading;
  }

  show(): void {
    this.hide();
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically()
    });
    const loaderPortal = new ComponentPortal(Loader);
    this.overlayRef.attach(loaderPortal);
    this._loading.set(true);
  }

  hide(): void {
    this.overlayRef?.detach();
    this.overlayRef = null;
    this._loading.set(false);
  }
}
