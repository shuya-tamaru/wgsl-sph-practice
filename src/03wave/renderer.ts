import { Particles } from "./Particles";
import { OrbitControls } from "./OrbitControls";
import { PerformanceMonitor, PerformanceConfig } from "../PerformanceMonitor";
import { WebGPUDevice } from "./core/WebGPUDevice";
import { BufferManager, BufferConfig } from "./core/BufferManager";
import { PipelineManager, PipelineConfig } from "./core/PipelineManager";
import { TransformManager } from "./core/TransformManager";

export class Renderer {
  canvas: HTMLCanvasElement;

  // Core components
  private webgpuDevice: WebGPUDevice;
  private bufferManager: BufferManager;
  private pipelineManager: PipelineManager;
  private transformManager: TransformManager;

  // Scene objects
  particles: Particles;
  orbitControls: OrbitControls;
  performanceMonitor: PerformanceMonitor;

  // Simulation parameters
  boxWidth: number = 200;
  boxHeight: number = 100;
  boxDepth: number = 200;
  particleCount: number = 2000000;

  velocities: Float32Array;
  t: number;

  constructor(
    canvas: HTMLCanvasElement,
    performanceConfig?: Partial<PerformanceConfig>
  ) {
    this.canvas = canvas;
    this.t = 0;
    this.performanceMonitor = new PerformanceMonitor(performanceConfig);

    // Initialize core components
    this.webgpuDevice = new WebGPUDevice(canvas);

    window.addEventListener("resize", this.handleResize);
  }

  async init() {
    // Initialize WebGPU device
    await this.webgpuDevice.init();

    // Initialize buffer manager
    this.bufferManager = new BufferManager(this.webgpuDevice.device);

    // Create scene assets
    this.createAssets();

    // Create buffers
    this.createBuffers();

    // Initialize pipeline manager
    this.pipelineManager = new PipelineManager(
      this.webgpuDevice.device,
      this.bufferManager
    );
    await this.createPipelines();

    // Initialize orbit controls and transform manager
    this.orbitControls = new OrbitControls(this.canvas, 200);
    this.transformManager = new TransformManager(
      this.canvas,
      this.orbitControls
    );

    this.render();
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
    this.webgpuDevice.destroy();
    this.pipelineManager.destroy();
  }

  private createAssets() {
    this.particles = new Particles(
      this.webgpuDevice.device,
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
      this.particleCount
    );
    this.velocities = new Float32Array(this.particles.particleCount * 4);
    this.velocities.fill(0);
  }

  private createBuffers() {
    const bufferConfig: BufferConfig = {
      particleCount: this.particles.particleCount,
      positionsSize: this.particles.positions.byteLength,
      velocitiesSize: this.velocities.byteLength,
    };

    this.bufferManager.createBuffers(bufferConfig);
  }

  private async createPipelines() {
    const pipelineConfig: PipelineConfig = {
      format: this.webgpuDevice.format,
      positionBufferLayout: this.particles.positionBufferLayout,
      colorBufferLayout: this.particles.colorBufferLayout,
    };

    await this.pipelineManager.createPipelines(pipelineConfig);
  }

  private handleResize = () => {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    this.webgpuDevice.reconfigure();
    this.transformManager.handleResize();
  };

  private updateSimulation() {
    const dt = 1 / 60;
    this.t += dt;

    // Update all buffers through buffer manager
    this.bufferManager.updateTimeBuffer(this.t);
    this.bufferManager.updateGridCountsBuffer(
      this.particles.xCount,
      this.particles.yCount,
      this.particles.zCount
    );
    this.bufferManager.updateBoxSizeBuffer(
      this.boxWidth,
      this.boxHeight,
      this.boxDepth
    );
    this.bufferManager.updateVelocityBuffer(this.velocities);
    this.bufferManager.updatePositionsBuffer(this.particles.positions);

    // Update transform matrices
    const matrices = this.transformManager.updateMatrices();
    this.bufferManager.updateTransformBuffer(
      matrices.model,
      matrices.view,
      matrices.projection
    );
  }

  private runComputePass(commandEncoder: GPUCommandEncoder) {
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.pipelineManager.getComputePipeline());
    computePass.setBindGroup(0, this.pipelineManager.getComputeBindGroup());

    const workgroupCount = Math.ceil(this.particles.particleCount / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();
  }

  private runRenderPass(commandEncoder: GPUCommandEncoder) {
    const textureView: GPUTextureView = this.webgpuDevice.context
      .getCurrentTexture()
      .createView();

    const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.webgpuDevice.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    renderpass.setPipeline(this.pipelineManager.getRenderPipeline());
    renderpass.setVertexBuffer(0, this.particles.positionBuffer);
    renderpass.setVertexBuffer(1, this.particles.colorBuffer);
    renderpass.setBindGroup(0, this.pipelineManager.getRenderBindGroup());
    renderpass.draw(this.particles.particleCount, 1, 0, 0);
    renderpass.end();
  }

  render = () => {
    this.performanceMonitor.begin();

    // Update simulation state
    this.updateSimulation();

    // Create command encoder and run passes
    const commandEncoder: GPUCommandEncoder =
      this.webgpuDevice.device.createCommandEncoder();

    this.runComputePass(commandEncoder);
    this.runRenderPass(commandEncoder);

    // Submit commands
    this.webgpuDevice.device.queue.submit([commandEncoder.finish()]);

    this.performanceMonitor.end();
    requestAnimationFrame(this.render);
  };
}
