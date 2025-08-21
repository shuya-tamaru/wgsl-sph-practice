export interface BufferConfig {
  particleCount: number;
  positionsSize: number;
  velocitiesSize: number;
}

export class BufferManager {
  private device: GPUDevice;

  // Transform buffers
  transformUniformBuffer: GPUBuffer;

  // Compute buffers
  timeUniformBuffer: GPUBuffer;
  waveParamsBuffer: GPUBuffer;
  heightFieldBuffer: GPUBuffer;
  waveStateBuffer: GPUBuffer;
  gridCountsBuffer: GPUBuffer;
  boxSizeBuffer: GPUBuffer;
  velocityBuffer: GPUBuffer;
  dynamicPositionsBuffer: GPUBuffer;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createBuffers(config: BufferConfig): void {
    this.createTransformBuffers();
    this.createComputeBuffers(config);
  }

  private createTransformBuffers(): void {
    // MVP matrix buffer (3 x 4x4 matrices)
    this.transformUniformBuffer = this.device.createBuffer({
      size: 128 * 3, // 64 bytes per matrix * 3 matrices
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createComputeBuffers(config: BufferConfig): void {
    // Time uniform buffer
    this.timeUniformBuffer = this.device.createBuffer({
      size: 4, // 4 bytes for f32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Grid counts buffer
    this.gridCountsBuffer = this.device.createBuffer({
      size: 4 * 3, // 3 u32 values
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Box size buffer
    this.boxSizeBuffer = this.device.createBuffer({
      size: 4 * 3, // 3 f32 values for vec3
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Velocity buffer
    this.velocityBuffer = this.device.createBuffer({
      size: config.velocitiesSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Dynamic positions buffer (updated by compute shader)
    this.dynamicPositionsBuffer = this.device.createBuffer({
      size: config.positionsSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Height field buffer
    this.heightFieldBuffer = this.device.createBuffer({
      size: 4 * config.particleCount, // f32 per particle
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  updateTimeBuffer(time: number): void {
    const timeData = new Float32Array([time]);
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, timeData);
  }

  updateGridCountsBuffer(xCount: number, yCount: number, zCount: number): void {
    const gridCounts = new Float32Array([xCount, yCount, zCount]);
    this.device.queue.writeBuffer(this.gridCountsBuffer, 0, gridCounts);
  }

  updateBoxSizeBuffer(width: number, height: number, depth: number): void {
    const boxSize = new Float32Array([width, height, depth]);
    this.device.queue.writeBuffer(this.boxSizeBuffer, 0, boxSize);
  }

  updateVelocityBuffer(velocities: Float32Array): void {
    this.device.queue.writeBuffer(this.velocityBuffer, 0, velocities.buffer);
  }

  updatePositionsBuffer(positions: Float32Array): void {
    this.device.queue.writeBuffer(
      this.dynamicPositionsBuffer,
      0,
      positions.buffer
    );
  }

  updateTransformBuffer(
    modelMatrix: Float32Array,
    viewMatrix: Float32Array,
    projectionMatrix: Float32Array
  ): void {
    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      0,
      modelMatrix.buffer
    );
    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      64,
      viewMatrix.buffer
    );
    this.device.queue.writeBuffer(
      this.transformUniformBuffer,
      128,
      projectionMatrix.buffer
    );
  }
}
