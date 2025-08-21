export class WebGPUDevice {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.format = "bgra8unorm";
  }

  async init(): Promise<void> {
    await this.setupDevice();
    this.recreateDepthBuffer();
  }

  private async setupDevice(): Promise<void> {
    this.adapter = (await navigator.gpu.requestAdapter()) as GPUAdapter;
    this.device = (await this.adapter.requestDevice()) as GPUDevice;

    const context = this.canvas.getContext("webgpu");
    if (!context) {
      throw new Error("WebGPU context not supported");
    }

    this.context = context as unknown as GPUCanvasContext;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }

  recreateDepthBuffer(): void {
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

  reconfigure(): void {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
    this.recreateDepthBuffer();
  }

  destroy(): void {
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
  }
}
