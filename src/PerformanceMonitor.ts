import Stats from "stats.js";

export interface PerformanceConfig {
  enabled: boolean;
}

export class PerformanceMonitor {
  private stats: Stats;
  private isEnabled: boolean = true;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.isEnabled = config.enabled !== false; // デフォルトで有効

    if (this.isEnabled) {
      this.stats = new Stats();
      this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
      document.body.appendChild(this.stats.dom);

      // スタイル調整
      this.stats.dom.style.position = "absolute";
      this.stats.dom.style.top = "0px";
      this.stats.dom.style.left = "0px";
      this.stats.dom.style.zIndex = "1000";
    }
  }

  begin(): void {
    if (this.isEnabled && this.stats) {
      this.stats.begin();
    }
  }

  end(): void {
    if (this.isEnabled && this.stats) {
      this.stats.end();
    }
  }

  toggle(): void {
    if (this.stats) {
      this.isEnabled = !this.isEnabled;
      this.stats.dom.style.display = this.isEnabled ? "block" : "none";
    }
  }

  setPanel(panel: number): void {
    if (this.stats) {
      this.stats.showPanel(panel);
    }
  }

  destroy(): void {
    if (this.stats && this.stats.dom.parentNode) {
      this.stats.dom.parentNode.removeChild(this.stats.dom);
    }
  }

  // 便利メソッド
  showFPS(): void {
    this.setPanel(0);
  }
  showMS(): void {
    this.setPanel(1);
  }
  showMB(): void {
    this.setPanel(2);
  }
}
