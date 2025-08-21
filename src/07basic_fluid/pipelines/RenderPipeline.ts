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
    timeStepBuffer: GPUBuffer
  ) {
    this.device = device;
    this.format = format;
    this.particles = particles;
    this.init(timeStepBuffer);
  }

  private init(timeStepBuffer: GPUBuffer) {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: timeStepBuffer } }],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({ code: particlesShader }),
        entryPoint: "vs_main",
        buffers: [
          this.particles.positionBufferLayout,
          this.particles.colorBufferLayout,
          this.particles.velocityBufferLayout,
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
      multisample: {
        count: 1,
      },
      depthStencil: {
        depthWriteEnabled: false, // 2D表示では深度テストを無効化
        depthCompare: "always",
        format: "depth24plus",
      },
      layout: pipelineLayout,
    });
  }

  draw(pass: GPURenderPassEncoder) {
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.particles.positionBuffer);
    pass.setVertexBuffer(1, this.particles.colorBuffer);
    pass.setVertexBuffer(2, this.particles.velocityBuffer);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(this.particles.particleCount, 1, 0, 0);
  }

  dispose() {}
}
