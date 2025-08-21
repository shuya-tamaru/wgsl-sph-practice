import shader from "../shaders/particles.wgsl";
import computeShader from "../shaders/compute.wgsl";
import { BufferManager } from "./BufferManager";

export interface PipelineConfig {
  format: GPUTextureFormat;
  positionBufferLayout: GPUVertexBufferLayout;
  colorBufferLayout: GPUVertexBufferLayout;
}

export class PipelineManager {
  private device: GPUDevice;
  private bufferManager: BufferManager;

  // Render pipeline objects
  renderPipeline: GPURenderPipeline;
  renderBindGroup: GPUBindGroup;
  renderBindGroupLayout: GPUBindGroupLayout;

  // Compute pipeline objects
  computePipeline: GPUComputePipeline;
  computeBindGroup: GPUBindGroup;
  computeBindGroupLayout: GPUBindGroupLayout;

  constructor(device: GPUDevice, bufferManager: BufferManager) {
    this.device = device;
    this.bufferManager = bufferManager;
  }

  async createPipelines(config: PipelineConfig): Promise<void> {
    await this.createRenderPipeline(config);
    await this.createComputePipeline();
  }

  private async createRenderPipeline(config: PipelineConfig): Promise<void> {
    // Create bind group layout for render pipeline
    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX, // transformUBO
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX, // positions
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    // Create bind group for render pipeline
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.bufferManager.transformUniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.bufferManager.dynamicPositionsBuffer },
        },
      ],
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.renderBindGroupLayout],
    });

    // Create render pipeline
    this.renderPipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "vs_main",
        buffers: [config.positionBufferLayout, config.colorBufferLayout],
      },

      fragment: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "fs_main",
        targets: [
          {
            format: config.format,
          },
        ],
      },

      primitive: {
        topology: "point-list",
      },

      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },

      layout: pipelineLayout,
    });
  }

  private async createComputePipeline(): Promise<void> {
    // Create shader module
    const computeShaderModule = this.device.createShaderModule({
      code: computeShader,
    });

    // Create bind group layout for compute pipeline
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // heightField
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStep
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridCounts
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // boxSize
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE, // velocity
          buffer: { type: "storage" },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE, // position
          buffer: { type: "storage" },
        },
      ],
    });

    // Create compute pipeline
    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.computeBindGroupLayout],
      }),
      compute: {
        module: computeShaderModule,
        entryPoint: "cs_main",
      },
    });

    // Create bind group for compute pipeline
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.bufferManager.heightFieldBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.bufferManager.timeUniformBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.bufferManager.gridCountsBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.bufferManager.boxSizeBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.bufferManager.velocityBuffer },
        },
        {
          binding: 5,
          resource: { buffer: this.bufferManager.dynamicPositionsBuffer },
        },
      ],
    });
  }

  // Utility methods for getting pipeline objects
  getRenderPipeline(): GPURenderPipeline {
    return this.renderPipeline;
  }

  getRenderBindGroup(): GPUBindGroup {
    return this.renderBindGroup;
  }

  getComputePipeline(): GPUComputePipeline {
    return this.computePipeline;
  }

  getComputeBindGroup(): GPUBindGroup {
    return this.computeBindGroup;
  }

  destroy(): void {
    // Pipeline objects are automatically cleaned up by WebGPU
  }
}
