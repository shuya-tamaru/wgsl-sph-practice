import { Particles } from "../Particles";
import collisionShader from "../shaders/collision.wgsl";

export class Collision {
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
      code: collisionShader,
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
          buffer: { type: "read-only-storage" }, // srcVelocitiesBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // forcesBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // collisionParamsBuffer
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
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particles.getPositionDstBuffer() },
        },
        {
          binding: 1,
          resource: { buffer: this.particles.getVelocitySrcBuffer() },
        },
        {
          binding: 2,
          resource: { buffer: this.particles.collisionForcesBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.collisionParamsBuffer },
        },
      ],
    });
  }

  buildIndex(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.particles.particleCount / 64));
    pass.end();
  }
}
