import particlesShader from "../shaders/particles.wgsl";
import { Particles } from "../Particles";

export class RenderPipeline {
  private device: GPUDevice;
  private format: GPUTextureFormat;
  private particles: Particles;

  private pipeline: GPURenderPipeline;
  private bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    particles: Particles,
    transformUBO: GPUBuffer,
    timeStepBuffer: GPUBuffer
  ) {
    this.device = device;
    this.format = format;
    this.particles = particles;
    this.init(transformUBO, timeStepBuffer);
  }

  private init(transformUBO: GPUBuffer, timeStepBuffer: GPUBuffer) {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: timeStepBuffer } },
        { binding: 1, resource: { buffer: transformUBO } },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({ code: particlesShader }),
        entryPoint: "vs_main",
        buffers: [
          this.particles.dstPositionsBufferLayout,
          this.particles.colorBufferLayout,
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: particlesShader }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
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

  draw(pass: GPURenderPassEncoder) {
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.particles.getPositionDstBuffer());
    pass.setVertexBuffer(1, this.particles.colorBuffer);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(this.particles.particleCount, 1, 0, 0);
  }

  dispose() {}
}
