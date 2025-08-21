export class Squares {
  public quadVertexBuffer: GPUBuffer;
  public quadIndexBuffer: GPUBuffer;
  public quadVertexBufferLayout: GPUVertexBufferLayout;
  public drawParamsBuffer: GPUBuffer;
  public bindGroupLayout: GPUBindGroupLayout;
  public pipeline: GPURenderPipeline;
  public bindGroup: GPUBindGroup;

  constructor(device: GPUDevice) {
    // prettier-ignore
    const size = 0.005
    const quadVertex = new Float32Array([
      -size,
      -size,
      size,
      -size,
      size,
      size,
      -size,
      size,
    ]);
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    this.quadVertexBuffer = device.createBuffer({
      size: quadVertex.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(quadVertex);
    this.quadVertexBuffer.unmap();

    this.quadIndexBuffer = device.createBuffer({
      size: quadIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(this.quadIndexBuffer.getMappedRange()).set(quadIndices);
    this.quadIndexBuffer.unmap();

    this.quadVertexBufferLayout = {
      arrayStride: 8, // 4 floats for xyzw
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }],
    };
  }
}
