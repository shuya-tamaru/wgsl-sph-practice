import { Particles } from "../Particles";
import viscosityShader from "../shaders/viscosity.wgsl";

export class Viscosity {
  private device: GPUDevice;
  private particles: Particles;

  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    particles: Particles,
    timeStepBuffer: GPUBuffer
  ) {
    this.device = device;
    this.particles = particles;
    this.init(timeStepBuffer);
  }

  private init(timeStepBuffer: GPUBuffer) {
    const module = this.device.createShaderModule({
      code: viscosityShader,
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
          buffer: { type: "read-only-storage" }, // cellStartIndicesBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // densityBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // sphParamsBuffer
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // gridParamsBuffer
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // srcVelocitiesBuffer
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // dstVelocitiesBuffer
        },
        {
          binding: 7,
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
        {
          binding: 2,
          resource: { buffer: this.particles.densityBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.particles.sphParamsBuffer },
        },
        {
          binding: 4,
          resource: { buffer: this.particles.gridParamsBuffer },
        },
        {
          binding: 5,
          resource: { buffer: this.particles.getVelocitySrcBuffer() },
        },
        {
          binding: 6,
          resource: { buffer: this.particles.getVelocityDstBuffer() },
        },
        {
          binding: 7,
          resource: { buffer: timeStepBuffer },
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

  dispose() {}
}
