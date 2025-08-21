export class WaveMesh {
  buffer: GPUBuffer;
  bufferLayout: GPUVertexBufferLayout;
  vertexCount: number = 512;

  constructor(device: GPUDevice) {
    const vertices = new Float32Array(this.vertexCount * 6); // xyz rgb

    for (let i = 0; i < this.vertexCount; i++) {
      const x = (i / (this.vertexCount - 1)) * 2.0 - 1.0; // -1 to 1
      const y = 0;
      const z = 0;

      // x y z
      vertices[i * 6 + 0] = x;
      vertices[i * 6 + 1] = y;
      vertices[i * 6 + 2] = z;

      // r g b
      vertices[i * 6 + 3] = 1.0;
      vertices[i * 6 + 4] = 1.0;
      vertices[i * 6 + 5] = 1.0;
    }

    const usage: GPUBufferUsageFlags =
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

    const descriptor: GPUBufferDescriptor = {
      size: vertices.byteLength,
      usage: usage,
      mappedAtCreation: true,
    };

    this.buffer = device.createBuffer(descriptor);
    new Float32Array(this.buffer.getMappedRange()).set(vertices);
    this.buffer.unmap();

    this.bufferLayout = {
      arrayStride: 24, // 3 floats for xyz, 3 floats for rgb (6 * 4bytes = 24 bytes)
      attributes: [
        {
          shaderLocation: 0,
          format: "float32x3",
          offset: 0,
        },
        {
          shaderLocation: 1,
          format: "float32x3",
          offset: 12,
        },
      ],
    };
  }

  updateVertices(device: GPUDevice, heightField: number[]) {
    const vertices = new Float32Array(this.vertexCount * 6);

    for (let i = 0; i < this.vertexCount - 1; i++) {
      const x = (i / (this.vertexCount - 1)) * 2.0 - 1.0;
      const heightIndex =
        (i / (this.vertexCount - 1)) * (heightField.length - 1);
      const height = heightField[Math.floor(heightIndex)] || 0.0;
      const y = height;
      const z = 0.0;

      // Position
      vertices[i * 6 + 0] = x;
      vertices[i * 6 + 1] = y;
      vertices[i * 6 + 2] = z;

      const intensity = Math.min(height * 2.0, 1.0);
      vertices[i * 6 + 3] = intensity; // r
      vertices[i * 6 + 4] = intensity; // g
      vertices[i * 6 + 5] = 1.0; // b
    }

    device.queue.writeBuffer(this.buffer, 0, vertices.buffer);
  }
}
