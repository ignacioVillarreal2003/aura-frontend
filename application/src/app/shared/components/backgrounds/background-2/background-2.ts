import {Component, ElementRef} from '@angular/core';

@Component({
  selector: 'app-background-2',
  imports: [],
  templateUrl: './background-2.html',
  styleUrl: './background-2.css'
})
export class Background2 {
  private layer: HTMLElement | undefined;

  private currentPosX: number[] = [];
  private currentPosY: number[] = [];
  private currentSizeX: number[] = [];
  private currentSizeY: number[] = [];

  private targetPosX: number[] = [];
  private targetPosY: number[] = [];
  private targetSizeX: number[] = [];
  private targetSizeY: number[] = [];

  private animationIntervalId: number | undefined;
  private changeTargetIntervalId: number | undefined;

  private lerpFactor = 0.005;

  constructor(private elRef: ElementRef) {}

  ngOnInit() {
    this.initPositions();

    this.layer = this.elRef.nativeElement.querySelector('.background-2__layer');

    this.generateNewTarget();

    this.animationIntervalId = window.setInterval(() => {
      this.updateCurrentValues();
      this.applyStyles();
    }, 50);

    this.changeTargetIntervalId = window.setInterval(() => {
      this.generateNewTarget();
    }, 10000);
  }

  ngOnDestroy() {
    if (this.animationIntervalId) {
      clearInterval(this.animationIntervalId);
    }
    if (this.changeTargetIntervalId) {
      clearInterval(this.changeTargetIntervalId);
    }
  }

  initPositions(): void {
    this.currentPosX = [0, 0, 0].map(() => 20 + Math.random() * 60);
    this.currentPosY = [0, 0, 0].map(() => 20 + Math.random() * 60);
    this.currentSizeX = [0, 0, 0].map(() => 300 + Math.random() * 100);
    this.currentSizeY = [0, 0, 0].map(() => 150 + Math.random() * 100);
  }

  generateNewTarget(): void {
    this.targetPosX = [0, 0, 0].map(() => 20 + Math.random() * 60);
    this.targetPosY = [0, 0, 0].map(() => 20 + Math.random() * 60);
    this.targetSizeX = [0, 0, 0].map(() => 300 + Math.random() * 100);
    this.targetSizeY = [0, 0, 0].map(() => 150 + Math.random() * 100);
  }

  updateCurrentValues() {
    for (let i = 0; i < 3; i++) {
      this.currentPosX[i] += (this.targetPosX[i] - this.currentPosX[i]) * this.lerpFactor;
      this.currentPosY[i] += (this.targetPosY[i] - this.currentPosY[i]) * this.lerpFactor;
      this.currentSizeX[i] += (this.targetSizeX[i] - this.currentSizeX[i]) * this.lerpFactor;
      this.currentSizeY[i] += (this.targetSizeY[i] - this.currentSizeY[i]) * this.lerpFactor;
    }
  }

  applyStyles(): void {
    if (this.layer != undefined) {
      this.layer.style.backgroundPosition = this.currentPosX
        .map((x, i) => `${x.toFixed(2)}% ${this.currentPosY[i].toFixed(2)}%`)
        .join(', ');

      this.layer.style.backgroundSize = this.currentSizeX
        .map((x, i) => `${x.toFixed(2)}% ${this.currentSizeY[i].toFixed(2)}%`)
        .join(', ');
    }
  }
}
