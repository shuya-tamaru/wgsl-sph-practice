import { mat4 } from "gl-matrix";
import shader from "./shaders/particles.wgsl";
import computeShader from "./shaders/compute.wgsl";
import fillGridShader from "./shaders/fill_grid.wgsl";
import countKeysShader from "./shaders/count_keys.wgsl";
import scanShader from "./shaders/scan.wgsl";
import reorderShader from "./shaders/reorder.wgsl";
import calcDensityShader from "./shaders/calc_density.wgsl";
import integrateShader from "./shaders/integrate.wgsl";
import calcPressureForcesShader from "./shaders/calc_pressure_and_forces.wgsl";
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
  fillGridPipeline: GPUComputePipeline;
  fillGridBindGroup: GPUBindGroup;
  countKeysPipeline: GPUComputePipeline;
  countKeysBindGroup: GPUBindGroup;
  scanPipeline: GPUComputePipeline;
  scanBindGroup: GPUBindGroup;
  reorderPipeline: GPUComputePipeline;
  reorderBindGroup: GPUBindGroup;
  calcDensityPipeline: GPUComputePipeline;
  calcDensityBindGroup: GPUBindGroup;
  calcPressureForcesPipeline: GPUComputePipeline;
  calcPressureForcesBindGroup: GPUBindGroup;
  integratePipeline: GPUComputePipeline;
  integrateBindGroup: GPUBindGroup;
  timeStepBuffer: GPUBuffer;

  // Pipeline objects
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;

  //computeBuffers
  timeUniformBuffer: GPUBuffer;
  boxSizeBuffer: GPUBuffer;
  gravityBuffer: GPUBuffer;
  gridCellCountBuffer: GPUBuffer;
  particlesParamsBuffer: GPUBuffer;

  // Uniform buffer
  transformUniformBuffer: GPUBuffer;

  particles: Particles;
  orbitControls: OrbitControls;
  performanceMonitor: PerformanceMonitor;

  //boxParams
  boxWidth: number = 200;
  boxHeight: number = 200;
  boxDepth: number = 200;
  xCount: number = 100;
  yCount: number = 100;
  zCount: number = 100;

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
    await this.createFillGridPipeline();
    await this.createCountKeysPipeline();
    await this.createScanPipeline();
    await this.createReorderPipeline();
    await this.createCalcDensityPipeline();
    await this.createCalcPressureForcesPipeline();
    await this.createIntegratePipeline();
    await this.createComputePipeline();

    this.orbitControls = new OrbitControls(this.canvas, 200);

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

    this.boxSizeBuffer = this.device.createBuffer({
      size: 4 * 3, // 4 bytes for box size
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.gravityBuffer = this.device.createBuffer({
      size: 4 * this.particles.particleCount, // 4 bytes for gravity
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.gravityBuffer,
      0,
      new Float32Array(this.particles.particleCount).fill(-9.8)
    );

    this.gridCellCountBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.particlesParamsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const particlesParams = new Float32Array([
      this.particles.particleCount,
      this.particles.h,
      this.particles.particleMass,
      this.particles.restDensity,
      this.particles.gasConstant,
      this.particles.viscosity,
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
    ]);

    this.device.queue.writeBuffer(
      this.particlesParamsBuffer,
      0,
      particlesParams
    );

    this.timeStepBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // boxSizeの初期設定（一度だけ）
    const boxSize = new Float32Array([
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
    ]);
    this.device.queue.writeBuffer(this.boxSizeBuffer, 0, boxSize);
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
            type: "uniform",
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
          resource: { buffer: this.timeUniformBuffer },
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
        topology: "point-list",
        // topology: "line-list",
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

  async createComputePipeline() {
    const computeShaderModule = this.device.createShaderModule({
      code: computeShader,
    });

    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStep
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // boxSize
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // positions
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // velocities
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // gravity
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
          resource: { buffer: this.timeUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.boxSizeBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.positionBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.velocityBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.gravityBuffer },
        },
      ],
    });
  }
  async createFillGridPipeline() {
    const fillGridShaderModule = this.device.createShaderModule({
      code: fillGridShader,
    });

    const fillGridBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStep
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // boxSize
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // positions
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // grid_particle_ids (read_write)
        },
      ],
    });

    this.fillGridPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [fillGridBindGroupLayout],
      }),
      compute: {
        module: fillGridShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.fillGridBindGroup = this.device.createBindGroup({
      layout: this.fillGridPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.timeUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.boxSizeBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.positionBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.gridParticleIdsBuffer },
        },
      ],
    });
  }

  async createCountKeysPipeline() {
    const countKeysShaderModule = this.device.createShaderModule({
      code: countKeysShader,
    });

    const countKeysBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStep
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridParticleCount
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // gridParticleIds
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // cellCounts (read_write)
        },
      ],
    });

    this.countKeysPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [countKeysBindGroupLayout],
      }),
      compute: {
        module: countKeysShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.countKeysBindGroup = this.device.createBindGroup({
      layout: this.countKeysPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.timeUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.gridCellCountBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.gridParticleIdsBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.cellCountsBuffer },
        },
      ],
    });
  }

  async createScanPipeline() {
    const scanShaderModule = this.device.createShaderModule({
      code: scanShader,
    });
    const scanBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridCellCount
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // input (cellCounts)
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // output (cellStartIndices)
        },
      ],
    });

    this.scanPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [scanBindGroupLayout],
      }),
      compute: {
        module: scanShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.scanBindGroup = this.device.createBindGroup({
      layout: this.scanPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.gridCellCountBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.particles.cellCountsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.cellStartIndicesBuffer },
        },
      ],
    });
  }

  async createReorderPipeline() {
    const reorderShaderModule = this.device.createShaderModule({
      code: reorderShader,
    });

    const reorderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // timeStep
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // gridParticleIds
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // cellStartIndices
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // original positions
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // original velocities
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }, // reordered positions
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }, // reordered velocities
      ],
    });

    this.reorderPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [reorderBindGroupLayout],
      }),
      compute: {
        module: reorderShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.reorderBindGroup = this.device.createBindGroup({
      layout: this.reorderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.timeUniformBuffer } },
        {
          binding: 1,
          resource: { buffer: this.particles.gridParticleIdsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.cellStartIndicesBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.positionBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.particles.velocityBuffer },
        },
        {
          binding: 5,
          resource: { buffer: this.particles.reorderedPositionsBuffer },
        },
        {
          binding: 6,
          resource: { buffer: this.particles.reorderedVelocitiesBuffer },
        },
      ],
    });
  }

  // src/Renderer.ts

  // ...
  async createCalcDensityPipeline() {
    const calcDensityShaderModule = this.device.createShaderModule({
      code: calcDensityShader,
    });

    const calcDensityBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // particles_params
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // reorderedPositions
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // cellStartIndices
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // densities
        },
      ],
    });

    this.calcDensityPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [calcDensityBindGroupLayout],
      }),
      compute: {
        module: calcDensityShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.calcDensityBindGroup = this.device.createBindGroup({
      layout: this.calcDensityPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particlesParamsBuffer } },
        {
          binding: 1,
          resource: { buffer: this.particles.reorderedPositionsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.cellStartIndicesBuffer },
        },
        { binding: 3, resource: { buffer: this.particles.densityBuffer } },
      ],
    });
  }
  // src/Renderer.ts

  // ...

  async createCalcPressureForcesPipeline() {
    const calcPressureForcesShaderModule = this.device.createShaderModule({
      code: calcPressureForcesShader,
    });

    const calcPressureForcesBindGroupLayout = this.device.createBindGroupLayout(
      {
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          }, // particles_params
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" },
          }, // reorderedPositions
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" },
          }, // reorderedVelocities
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" },
          }, // densities
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "read-only-storage" },
          }, // cellStartIndices
          {
            binding: 5,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" },
          }, // pressures
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "storage" },
          }, // forces
        ],
      }
    );

    this.calcPressureForcesPipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [calcPressureForcesBindGroupLayout],
      }),
      compute: {
        module: calcPressureForcesShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.calcPressureForcesBindGroup = this.device.createBindGroup({
      layout: this.calcPressureForcesPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particlesParamsBuffer } },
        {
          binding: 1,
          resource: { buffer: this.particles.reorderedPositionsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.reorderedVelocitiesBuffer },
        },
        { binding: 3, resource: { buffer: this.particles.densityBuffer } },
        {
          binding: 4,
          resource: { buffer: this.particles.cellStartIndicesBuffer },
        },
        { binding: 5, resource: { buffer: this.particles.pressureBuffer } },
        { binding: 6, resource: { buffer: this.particles.forceBuffer } },
      ],
    });
  }

  async createIntegratePipeline() {
    const integrateShaderModule = this.device.createShaderModule({
      code: integrateShader,
    });

    const integrateBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // particles_params
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        }, // time_step
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // forces
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // reorderedPositions
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        }, // reorderedVelocities
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }, // positions
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }, // velocities
      ],
    });

    this.integratePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [integrateBindGroupLayout],
      }),
      compute: {
        module: integrateShaderModule,
        entryPoint: "cs_main",
      },
    });

    // NOTE: reorderedバッファではなく、元のバッファをバインド
    this.integrateBindGroup = this.device.createBindGroup({
      layout: this.integratePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particlesParamsBuffer } },
        { binding: 1, resource: { buffer: this.timeStepBuffer } },
        { binding: 2, resource: { buffer: this.particles.forceBuffer } },
        {
          binding: 3,
          resource: { buffer: this.particles.reorderedPositionsBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.particles.reorderedVelocitiesBuffer },
        },
        { binding: 5, resource: { buffer: this.particles.positionBuffer } },
        { binding: 6, resource: { buffer: this.particles.velocityBuffer } },
      ],
    });
  }

  createAssets() {
    this.particles = new Particles(
      this.device,
      this.boxWidth,
      this.boxHeight,
      this.boxDepth,
      this.xCount,
      this.yCount,
      this.zCount
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

  render = (timestamp: number) => {
    this.performanceMonitor.begin();
    const dt = this.t ? (timestamp - this.t) / 100 : 0;
    this.t = timestamp;

    const timeStep = new Float32Array([0.005]); // 適切な値に調整
    this.device.queue.writeBuffer(this.timeStepBuffer, 0, timeStep);

    this.createTransformData();

    const timeData = new Float32Array([dt]);
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, timeData);

    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();

    //01 fill grid
    const fillGridPass = commandEncoder.beginComputePass();
    fillGridPass.setPipeline(this.fillGridPipeline);
    fillGridPass.setBindGroup(0, this.fillGridBindGroup);
    const fillGridWorkgroupCount = Math.ceil(this.particles.particleCount / 64);
    fillGridPass.dispatchWorkgroups(fillGridWorkgroupCount);
    fillGridPass.end();

    // 02 count keys
    const countKeysPass = commandEncoder.beginComputePass();
    countKeysPass.setPipeline(this.countKeysPipeline);
    countKeysPass.setBindGroup(0, this.countKeysBindGroup);
    const countKeysWorkgroupCount = Math.ceil(
      this.particles.particleCount / 64
    );
    countKeysPass.dispatchWorkgroups(countKeysWorkgroupCount);
    countKeysPass.end();

    //03 scan
    const scanPass = commandEncoder.beginComputePass();
    scanPass.setPipeline(this.scanPipeline);
    scanPass.setBindGroup(0, this.scanBindGroup);
    const scanWorkgroupCount = Math.ceil(this.particles.gridCellCount / 128);
    scanPass.dispatchWorkgroups(scanWorkgroupCount);
    scanPass.end();

    //04 reorder
    const reorderPass = commandEncoder.beginComputePass();
    reorderPass.setPipeline(this.reorderPipeline);
    reorderPass.setBindGroup(0, this.reorderBindGroup);
    const reorderWorkgroupCount = Math.ceil(this.particles.particleCount / 64);
    reorderPass.dispatchWorkgroups(reorderWorkgroupCount);
    reorderPass.end();

    //05 calc density
    const calcDensityPass = commandEncoder.beginComputePass();
    calcDensityPass.setPipeline(this.calcDensityPipeline);
    calcDensityPass.setBindGroup(0, this.calcDensityBindGroup);
    const calcDensityWorkgroupCount = Math.ceil(
      this.particles.particleCount / 64
    );
    calcDensityPass.dispatchWorkgroups(calcDensityWorkgroupCount);
    calcDensityPass.end();

    //06 calc pressure and forces

    const calcPressureForcesPass = commandEncoder.beginComputePass();
    calcPressureForcesPass.setPipeline(this.calcPressureForcesPipeline);
    calcPressureForcesPass.setBindGroup(0, this.calcPressureForcesBindGroup);
    const calcPressureForcesWorkgroupCount = Math.ceil(
      this.particles.particleCount / 64
    );
    calcPressureForcesPass.dispatchWorkgroups(calcPressureForcesWorkgroupCount);
    calcPressureForcesPass.end();

    //07 integrate
    const integratePass = commandEncoder.beginComputePass();
    integratePass.setPipeline(this.integratePipeline);
    integratePass.setBindGroup(0, this.integrateBindGroup);
    const integrateWorkgroupCount = Math.ceil(
      this.particles.particleCount / 64
    );
    integratePass.dispatchWorkgroups(integrateWorkgroupCount);
    integratePass.end();

    // //08 gravity
    // const computePass = commandEncoder.beginComputePass();
    // computePass.setPipeline(this.computePipeline);
    // computePass.setBindGroup(0, this.computeBindGroup);
    // const workgroupCount = Math.ceil(this.particles.particleCount / 64);
    // computePass.dispatchWorkgroups(workgroupCount);
    // computePass.end();

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
