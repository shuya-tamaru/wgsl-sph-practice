import { PerformanceConfig, PerformanceMonitor } from "./PerformanceMonitor";

export class SetUpDevice {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;
  performanceMonitor: PerformanceMonitor;

  constructor(
    canvas: HTMLCanvasElement,
    performanceConfig?: Partial<PerformanceConfig>
  ) {
    this.canvas = canvas;
    this.performanceMonitor = new PerformanceMonitor(performanceConfig);
  }

  async init() {
    await this.setupDevice();
  }

  async setupDevice() {
    this.adapter = (await navigator.gpu.requestAdapter()) as GPUAdapter;
    this.device = (await this.adapter.requestDevice()) as GPUDevice;
    const context = this.canvas.getContext("webgpu");
    if (!context) {
      throw new Error("WebGPU context not supported");
    }
    this.context = context as unknown as GPUCanvasContext;
    this.format = "bgra8unorm";
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });

    this.recreateDepthBuffer();
  }

  private recreateDepthBuffer(): void {
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size: { width: this.canvas.width, height: this.canvas.height },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.depthTextureView = this.depthTexture.createView();
  }
}
