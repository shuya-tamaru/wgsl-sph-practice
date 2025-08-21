import { mat4 } from "gl-matrix";
import shader from "./shaders/particles.wgsl";
import computeShader from "./shaders/compute.wgsl";
import { Particles } from "./Particles";
import { OrbitControls } from "./OrbitControls";
import { PerformanceMonitor, PerformanceConfig } from "../PerformanceMonitor";

export class Renderer {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;
  computePipeline: GPUComputePipeline;
  computeBindGroup: GPUBindGroup;

  // Pipeline objects
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;

  //computeBuffers
  timeUniformBuffer: GPUBuffer;
  waveParamsBuffer: GPUBuffer;
  heightFieldBuffer: GPUBuffer;
  waveStateBuffer: GPUBuffer;
  gridCountsBuffer: GPUBuffer;
  boxSizeBuffer: GPUBuffer;

  // Uniform buffer
  transformUniformBuffer: GPUBuffer;

  particles: Particles;
  orbitControls: OrbitControls;
  performanceMonitor: PerformanceMonitor;

  //boxParams
  boxWidth: number = 200;
  boxHeight: number = 100;
  boxDepth: number = 200;
  particleCount: number = 2000000;

  waveX: number = 20;
  waveY: number = 30;
  speedX: number = 60;
  speedY: number = -80;
  waveLengthX: number = 2;
  waveLengthY: number = 3;
  maxHeightX: number = 40;
  maxHeightY: number = 30;
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
    this.createAssets();
    this.createBuffers();
    await this.createPipeline();
    await this.createComputePipeline();

    this.orbitControls = new OrbitControls(this.canvas, 200);

    this.render();
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

  private handleResize = () => {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });

    this.recreateDepthBuffer();
    this.createTransformData();
  };

  createBuffers() {
    //mvp matrix
    this.transformUniformBuffer = this.device.createBuffer({
      size: 128 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    //time
    this.timeUniformBuffer = this.device.createBuffer({
      size: 4, // 4 bytes for time
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    //waveParams
    this.waveParamsBuffer = this.device.createBuffer({
      size: 32, // 32 bytes for wave parameters
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    //waveState
    this.waveStateBuffer = this.device.createBuffer({
      size: 4 * 4, // 16 bytes for wave state
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.gridCountsBuffer = this.device.createBuffer({
      size: 4 * 3, // 4 bytes for grid count
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.boxSizeBuffer = this.device.createBuffer({
      size: 4 * 3, // 4 bytes for box size
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    //heightField
    this.heightFieldBuffer = this.device.createBuffer({
      size: 4 * this.particles.particleCount,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  async createPipeline() {
    const renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.transformUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.heightFieldBuffer },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "vs_main",
        buffers: [
          this.particles.positionBufferLayout,
          this.particles.colorBufferLayout,
        ],
      },

      fragment: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "fs_main",
        targets: [
          {
            format: this.format,
          },
        ],
      },

      primitive: {
        // topology: "point-list",
        topology: "line-list",
        // topology: "line-strip",
        // topology: "triangle-list",
        // topology: "triangle-strip";
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },

      layout: pipelineLayout,
    });
  }

  updateWave(x: number, speed: number, timeInterval: number): [number, number] {
    const xMin = -this.boxWidth;
    const xMax = this.boxWidth;
    x += timeInterval * speed;

    if (x > xMax) {
      speed *= -1;
      x = xMax + timeInterval * speed;
    } else if (x < xMin) {
      speed *= -1;
      x = xMin + timeInterval * speed;
    }

    return [x, speed];
  }

  createAssets() {
    this.particles = new Particles(
      this.device,
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
      this.particleCount
    );
  }

  createTransformData() {
    const projection = mat4.create();
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(projection, Math.PI / 2, aspect, 0.1, 500);

    this.orbitControls.updateCamera();
    const view = this.orbitControls.getViewMatrix();

    const model = mat4.create();

    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      0,
      new Float32Array(model).buffer
    );

    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      64,
      new Float32Array(view).buffer
    );

    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      128,
      new Float32Array(projection).buffer
    );
  }

  async createComputePipeline() {
    const computeShaderModule = this.device.createShaderModule({
      code: computeShader,
    });

    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // waveState
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // waveParams
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // heightField
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStep
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridCounts
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // boxSize
        },
      ],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        module: computeShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.waveStateBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.waveParamsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.heightFieldBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.timeUniformBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.gridCountsBuffer },
        },
        {
          binding: 5,
          resource: { buffer: this.boxSizeBuffer },
        },
      ],
    });
  }

  render = () => {
    this.performanceMonitor.begin();

    const timeInterval = 1 / 50;
    this.t += timeInterval;
    this.createTransformData();

    const timeData = new Float32Array([this.t]);
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, timeData);

    [this.waveX, this.speedX] = this.updateWave(
      this.waveX,
      this.speedX,
      timeInterval
    );

    [this.waveY, this.speedY] = this.updateWave(
      this.waveY,
      this.speedY,
      timeInterval
    );

    const waveState = new Float32Array([
      this.waveX,
      this.waveY,
      this.speedX,
      this.speedY,
    ]);
    this.device.queue.writeBuffer(this.waveStateBuffer, 0, waveState);

    const waveParams = new Float32Array([
      this.waveLengthX, // waveLengthX
      this.waveLengthY, // waveLengthY
      this.maxHeightX, // maxHeightX
      this.maxHeightY, // maxHeightY
    ]);
    this.device.queue.writeBuffer(this.waveParamsBuffer, 0, waveParams);

    const gridCounts = new Float32Array([
      this.particles.xCount,
      this.particles.yCount,
      this.particles.zCount,
    ]);
    this.device.queue.writeBuffer(this.gridCountsBuffer, 0, gridCounts);

    const boxSize = new Float32Array([
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
    ]);
    this.device.queue.writeBuffer(this.boxSizeBuffer, 0, boxSize);

    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    const workgroupCount = Math.ceil(this.particles.particleCount / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    const textureView: GPUTextureView = this.context
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
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    renderpass.setPipeline(this.pipeline);
    renderpass.setVertexBuffer(0, this.particles.positionBuffer);
    renderpass.setVertexBuffer(1, this.particles.colorBuffer);
    renderpass.setBindGroup(0, this.bindGroup);
    renderpass.draw(this.particles.particleCount, 1, 0, 0);
    renderpass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    this.performanceMonitor.end();
    requestAnimationFrame(this.render);
  };
}
