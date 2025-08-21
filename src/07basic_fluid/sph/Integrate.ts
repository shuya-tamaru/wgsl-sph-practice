import { Particles } from "../Particles";
import integrateShader from "../shaders/integrateShader.wgsl";

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
          buffer: { type: "storage" }, // positionsBuffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // velocitiesBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // pressureForces
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // viscositiesBuffer
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // particleParamsBuffer
        },
        {
          binding: 5,
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
        { binding: 0, resource: this.particles.positionBuffer },
        { binding: 1, resource: this.particles.velocityBuffer },
        { binding: 2, resource: this.particles.pressureForceBuffer },
        { binding: 3, resource: this.particles.viscosityBuffer },
        { binding: 4, resource: this.particles.particleParamsBuffer },
        { binding: 5, resource: this.timeStepBuffer },
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
