import { Particles } from "../Particles";
import pressureForceShader from "../shaders/pressureForceShader.wgsl";

export class PressureForce {
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
      code: pressureForceShader,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // positionsBuffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // pressureBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // densityBuffer
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // pressureForceBuffer
        },
        {
          binding: 4,
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
        { binding: 0, resource: this.particles.positionBuffer },
        { binding: 1, resource: this.particles.pressureBuffer },
        { binding: 2, resource: this.particles.densityBuffer },
        { binding: 3, resource: this.particles.pressureForceBuffer },
        { binding: 4, resource: this.particles.particleParamsBuffer },
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
