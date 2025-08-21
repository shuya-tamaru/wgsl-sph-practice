import { Particles } from "../Particles";
import integrateShader from "../shaders/integrate.wgsl";

export class Integrate {
  private device: GPUDevice;
  private particles: Particles;
  private timeStepBuffer: GPUBuffer;

  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    particles: Particles,
    timeStepBuffer: GPUBuffer
  ) {
    this.device = device;
    this.particles = particles;
    this.timeStepBuffer = timeStepBuffer;
    this.init();
  }

  private init() {
    const module = this.device.createShaderModule({
      code: integrateShader,
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
          buffer: { type: "read-only-storage" }, // pressureForceBuffer
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // viscosityBuffer
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // collisionForcesBuffer
        },
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // sphParamsBuffer
        },
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // timeStepBuffer
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
          resource: { buffer: this.particles.pressureForceBuffer },
        },
        {
          binding: 5,
          resource: { buffer: this.particles.viscosityBuffer },
        },
        {
          binding: 6,
          resource: { buffer: this.particles.collisionForcesBuffer },
        },
        {
          binding: 7,
          resource: { buffer: this.particles.sphParamsBuffer },
        },
        {
          binding: 8,
          resource: { buffer: this.timeStepBuffer },
        },
      ],
    });
  }

  clear(encoder: GPUCommandEncoder) {
    encoder.clearBuffer(this.particles.pressureForceBuffer);
    encoder.clearBuffer(this.particles.viscosityBuffer);
    encoder.clearBuffer(this.particles.collisionForcesBuffer);
  }

  buildIndex(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.particles.particleCount / 64));
    pass.end();
  }

  dispose() {}
}
