import { Particles } from "../Particles";
import gravityShader from "../shaders/gravityShader.wgsl";

export class Gravity {
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
      code: gravityShader,
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
          buffer: { type: "uniform" }, // timeStepBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // particleParamsBuffer
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
        { binding: 0, resource: { buffer: this.particles.positionBuffer } },
        {
          binding: 1,
          resource: { buffer: this.particles.velocityBuffer },
        },
        { binding: 2, resource: { buffer: this.timeStepBuffer } },
        {
          binding: 3,
          resource: { buffer: this.particles.particleParamsBuffer },
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
