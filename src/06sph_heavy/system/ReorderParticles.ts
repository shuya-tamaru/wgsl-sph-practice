import { Particles } from "../Particles";
import reorderParticlesShader from "../shaders/reorderParticles.wgsl";

export class ReorderParticles {
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
      code: reorderParticlesShader,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // srcPositionsBuffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // dstPositionsBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // srcVelocitiesBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // dstVelocitiesBuffer
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // gridParticleIdsBuffer
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridParamsBuffer
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
          resource: { buffer: this.particles.getPositionSrcBuffer() },
        },
        {
          binding: 1,
          resource: { buffer: this.particles.getPositionDstBuffer() },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.getVelocitySrcBuffer() },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.getVelocityDstBuffer() },
        },
        {
          binding: 4,
          resource: { buffer: this.particles.gridParticleIdsBuffer },
        },
        { binding: 5, resource: { buffer: this.particles.gridParamsBuffer } },
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
