import { Particles } from "./Particles";
import { OrbitControls } from "./OrbitControls";
import { PerformanceMonitor, PerformanceConfig } from "../PerformanceMonitor";
import { debugReadBuffer } from "./utils/debugReadBuffer";
import { TransformSystem } from "./system/TransformSystem";
import { RenderPipeline } from "./pipelines/RenderPipeline";
import { TimeStep } from "./system/TimeStep";
import { RenderTargets } from "./pipelines/RenderTargets";
import { Gravity } from "./sph/Gravity";
import { Density } from "./sph/Density";
import { Pressure } from "./sph/Pressure";
import { PressureForce } from "./sph/PressureForce";
import { Integrate } from "./sph/Integrate";
import { Viscosity } from "./sph/Viscosity";

export class Renderer {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;

  //render pipeline
  renderPipeline: RenderPipeline;
  renderTargets: RenderTargets;

  //sph pipeline
  gravity: Gravity;
  density: Density;
  pressure: Pressure;
  pressureForce: PressureForce;
  viscosity: Viscosity;
  integrate: Integrate;

  timeStep: TimeStep;

  particles: Particles;
  performanceMonitor: PerformanceMonitor;

  t: number;

  constructor(
    canvas: HTMLCanvasElement,
    performanceConfig?: Partial<PerformanceConfig>
  ) {
    this.canvas = canvas;
    this.t = 0;
    this.performanceMonitor = new PerformanceMonitor(performanceConfig);
    window.addEventListener("resize", this.handleResize);
  }

  async init() {
    await this.setupDevice();

    this.renderTargets = new RenderTargets(this.device, this.canvas);
    this.createAssets(); //particlesとか
    this.createBasicBuffers(); //timeStepとか

    this.renderPipeline = new RenderPipeline(
      this.device,
      this.format,
      this.particles,
      this.timeStep.getBuffer()
    );

    this.gravity = new Gravity(
      this.device,
      this.particles,
      this.timeStep.getBuffer()
    );

    this.density = new Density(this.device, this.particles);
    this.pressure = new Pressure(this.device, this.particles);
    this.pressureForce = new PressureForce(this.device, this.particles);
    this.viscosity = new Viscosity(this.device, this.particles);
    this.integrate = new Integrate(
      this.device,
      this.particles,
      this.timeStep.getBuffer()
    );
    this.render(this.t);
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
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
  }

  private handleResize = () => {
    this.renderTargets.updateCanvasSize();
  };

  createBasicBuffers() {
    this.timeStep = new TimeStep(this.device);
  }

  createAssets() {
    this.particles = new Particles(this.device);
  }

  render = (timestamp: number) => {
    this.performanceMonitor.begin();

    // const dt = this.t ? (timestamp - this.t) / 1000 : 0.016; // 16ms = 60fps
    const dt = 0.01;
    this.t = timestamp;

    this.timeStep.set(dt);

    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();

    this.gravity.buildIndex(commandEncoder);
    this.density.buildIndex(commandEncoder);
    this.pressure.buildIndex(commandEncoder);
    this.pressureForce.buildIndex(commandEncoder);
    this.viscosity.buildIndex(commandEncoder);
    this.integrate.buildIndex(commandEncoder);

    const swapView = this.context.getCurrentTexture().createView();
    const renderpass: GPURenderPassEncoder = this.renderTargets.beginMainPass(
      commandEncoder,
      swapView
    );

    this.renderPipeline.draw(renderpass);
    renderpass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.performanceMonitor.end();

    requestAnimationFrame(this.render);

    // // デバッグ用：パーティクルの位置を確認
    // if (Math.round(this.t) % 60 === 0) {
    //   this.device.queue
    //     .onSubmittedWorkDone()
    //     .then(() => this.debug(this.device, this.particles));
    // }
  };

  //debug
  async debug(device: GPUDevice, p: Particles) {
    const result = await debugReadBuffer(
      this.device,
      this.particles.viscosityBuffer,
      this.particles.particleCount * 4 * 4
    );

    const float32View = new Float32Array(result);
    console.log(float32View);
  }
}
