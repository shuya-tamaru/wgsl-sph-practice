export class RenderTargets {
  device: GPUDevice;
  canvas: HTMLCanvasElement;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    this.recreateDepth();
  }

  private depth: GPUTexture;
  private depthView: GPUTextureView;
  private clear = { r: 1, g: 1, b: 1, a: 1 };

  recreateDepth() {
    if (this.depth) this.depth.destroy();
    this.depth = this.device.createTexture({
      size: { width: this.canvas.width, height: this.canvas.height },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depth.createView();
  }

  beginMainPass(encoder: GPUCommandEncoder, colorView: GPUTextureView) {
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorView,
          clearValue: this.clear,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
  }
}
