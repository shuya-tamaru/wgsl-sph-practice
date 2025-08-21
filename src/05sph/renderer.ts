import { Particles } from "./Particles";
import { OrbitControls } from "./OrbitControls";
import { PerformanceMonitor, PerformanceConfig } from "../PerformanceMonitor";
import { debugReadBuffer } from "./utils/debugReadBuffer";
import { CalcCellIndices } from "./system/CalcCellIndices";
import { TransformSystem } from "./system/TransformSystem";
import { RenderPipeline } from "./pipelines/RenderPipeline";
import { TimeStep } from "./system/TimeStep";
import { RenderTargets } from "./pipelines/RenderTargets";
import { CellStartIndices } from "./system/CellStartIndices";
import { Scatter } from "./system/Scatter";
import { ReorderParticles } from "./system/ReorderParticles";
import { Density } from "./sph/Density";
import { Pressure } from "./sph/Pressure";
import { PressureForce } from "./sph/PressureForce";
import { Viscosity } from "./sph/Viscosity";
import { Collision } from "./sph/Collision";
import { Integrate } from "./sph/Integrate";

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
  calcCellIndices: CalcCellIndices;
  cellStartIndices: CellStartIndices;
  scatter: Scatter;
  reorderParticles: ReorderParticles;

  //sph pipeline
  density: Density;
  pressure: Pressure;
  pressureForce: PressureForce;
  viscosity: Viscosity;
  collision: Collision;
  integrate: Integrate;
  transformSystem: TransformSystem;
  renderTargets: RenderTargets;

  timeStep: TimeStep;

  particles: Particles;
  orbitControls: OrbitControls;
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
    this.createTransformData(); //mvp matrix

    this.renderPipeline = new RenderPipeline(
      this.device,
      this.format,
      this.particles,
      this.transformSystem.getBuffer(),
      this.timeStep.getBuffer()
    );

    this.calcCellIndices = new CalcCellIndices(this.device, this.particles);
    this.cellStartIndices = new CellStartIndices(this.device, this.particles);
    this.scatter = new Scatter(this.device, this.particles);
    this.reorderParticles = new ReorderParticles(this.device, this.particles);
    this.density = new Density(this.device, this.particles);
    this.pressure = new Pressure(this.device, this.particles);
    this.pressureForce = new PressureForce(this.device, this.particles);
    this.viscosity = new Viscosity(
      this.device,
      this.particles,
      this.timeStep.getBuffer()
    );
    this.collision = new Collision(this.device, this.particles);
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
    this.renderTargets.recreateDepth();
    const aspect = this.canvas.width / this.canvas.height;
    this.transformSystem.setPerspective(Math.PI / 2, aspect, 0.1, 500);
    this.transformSystem.update();
  };

  createBasicBuffers() {
    this.timeStep = new TimeStep(this.device);
  }

  createAssets() {
    this.particles = new Particles(this.device);
    this.orbitControls = new OrbitControls(this.canvas, 20);
  }

  createTransformData() {
    this.transformSystem = new TransformSystem(this.device);
    const aspect = this.canvas.width / this.canvas.height;
    this.transformSystem.setPerspective(Math.PI / 2, aspect, 0.1, 500);
    this.transformSystem.update();
  }

  render = (timestamp: number) => {
    this.performanceMonitor.begin();

    const dt = this.t ? (timestamp - this.t) / 1000 : 0.016; // 16ms = 60fps
    this.t = timestamp;

    this.timeStep.set(dt);

    this.orbitControls.updateCamera();
    const view = this.orbitControls.getViewMatrix();
    this.transformSystem.setView(view);
    this.transformSystem.update();

    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();

    //00 clear cellCounts
    //01 calc cell indices
    this.calcCellIndices.clear(commandEncoder);
    this.calcCellIndices.buildIndex(commandEncoder);
    //02 build cell start indices
    this.cellStartIndices.buildIndex(commandEncoder);
    //03 scatter
    this.scatter.clear(commandEncoder);
    this.scatter.buildIndex(commandEncoder);
    //04 reorder particles

    this.reorderParticles.buildIndex(commandEncoder);

    this.integrate.clear(commandEncoder);
    //sph pipeline
    //05 density
    this.density.buildIndex(commandEncoder);
    //06 pressure
    this.pressure.buildIndex(commandEncoder);
    //07 pressure force
    this.pressureForce.buildIndex(commandEncoder);
    //08 viscosity
    this.viscosity.buildIndex(commandEncoder);
    //09 collision
    this.collision.buildIndex(commandEncoder);
    //10 integrate
    this.integrate.buildIndex(commandEncoder);

    this.particles.swapBuffers();

    const swapView = this.context.getCurrentTexture().createView();
    const renderpass: GPURenderPassEncoder = this.renderTargets.beginMainPass(
      commandEncoder,
      swapView
    );

    this.renderPipeline.draw(renderpass);
    renderpass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.performanceMonitor.end();

    // if (Math.round(this.t) % 60 === 0) {
    //   this.device.queue
    //     .onSubmittedWorkDone()
    //     .then(() => this.debug(this.device, this.particles));
    // }

    requestAnimationFrame(this.render);
  };

  //debug
  async debug(device: GPUDevice, p: Particles) {
    const result = await debugReadBuffer(
      this.device,
      this.particles.forcesBuffer,
      this.particles.particleCount * 4 * 4
    );

    const float32View = new Float32Array(result);
    console.log(float32View);
  }
}
