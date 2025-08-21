import particlesShader from "../shaders/particles.wgsl";
import { Particles } from "../Particles";
import { Squares } from "../Squares";

export class RenderPipeline {
  private device: GPUDevice;
  private format: GPUTextureFormat;
  private particles: Particles;
  private squares: Squares;

  private pipeline: GPURenderPipeline;
  private bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    particles: Particles,
    timeStepBuffer: GPUBuffer,
    squares: Squares
  ) {
    this.device = device;
    this.format = format;
    this.particles = particles;
    this.squares = squares;
    this.init(timeStepBuffer);
  }

  private init(timeStepBuffer: GPUBuffer) {
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX, //timeStep
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },

        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: timeStepBuffer } },
        { binding: 1, resource: { buffer: this.particles.positionBuffer } },
        { binding: 2, resource: { buffer: this.particles.colorBuffer } },
        { binding: 3, resource: { buffer: this.particles.velocityBuffer } },
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
          // this.particles.positionBufferLayout,
          // this.particles.colorBufferLayout,
          // this.particles.velocityBufferLayout,
          this.squares.quadVertexBufferLayout,
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: particlesShader }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
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
    pass.setVertexBuffer(0, this.squares.quadVertexBuffer);
    pass.setIndexBuffer(this.squares.quadIndexBuffer, "uint16");
    pass.setBindGroup(0, this.bindGroup);
    pass.drawIndexed(6, this.particles.particleCount);
  }

  dispose() {}
}
