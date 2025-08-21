import { Particles } from "../Particles";
import calcCellIndicesShader from "../shaders/calcCellIndices.wgsl";

export class CalcCellIndices {
  private device: GPUDevice;
  private particles: Particles;

  private pipeline!: GPUComputePipeline;
  private bindGroup!: GPUBindGroup;

  constructor(device: GPUDevice, particles: Particles) {
    this.device = device;
    this.particles = particles;
    this.init();
  }

  private init() {
    const module = this.device.createShaderModule({
      code: calcCellIndicesShader,
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
          buffer: { type: "storage" }, // cellCountsBuffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // cellIndicesBuffer
        },
        {
          binding: 3,
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
        { binding: 1, resource: { buffer: this.particles.cellCountsBuffer } },
        { binding: 2, resource: { buffer: this.particles.cellIndicesBuffer } },
        { binding: 3, resource: { buffer: this.particles.gridParamsBuffer } },
      ],
    });
  }

  clear(encoder: GPUCommandEncoder) {
    encoder.clearBuffer(this.particles.cellCountsBuffer);
  }

  buildIndex(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.particles.particleCount / 64));
    pass.end();
  }

  dispose() {
    // いまは破棄対象なし（必要ならここに）
  }
}
