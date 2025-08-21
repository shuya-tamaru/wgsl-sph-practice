import { Particles } from "../Particles";
import densityShader from "../shaders/calcDensity.wgsl";

export class Density {
  private device: GPUDevice;
  private particles: Particles;

  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;

  constructor(device: GPUDevice, particles: Particles) {
    this.device = device;
    this.particles = particles;
    this.init();
  }

  private init() {
    const module = this.device.createShaderModule({
      code: densityShader,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // dstPositionsBuffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // cellStartIndices
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridParamsBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // sphParamsBuffer
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // densityBuffer
        },
      ],
    });

    this.pipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module, entryPoint: "cs_main" },
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particles.getPositionDstBuffer() },
        },
        {
          binding: 1,
          resource: { buffer: this.particles.cellStartIndicesBuffer },
        },
        { binding: 2, resource: { buffer: this.particles.gridParamsBuffer } },
        { binding: 3, resource: { buffer: this.particles.sphParamsBuffer } },
        { binding: 4, resource: { buffer: this.particles.densityBuffer } },
      ],
    });
  }

  buildIndex(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.particles.particleCount / 128));
    pass.end();
  }

  dispose() {
    // いまは破棄対象なし（必要ならここに）
  }
}
