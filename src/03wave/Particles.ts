export class Particles {
  public positions: Float32Array;
  public colors: Float32Array;

  // GPUバッファ
  public positionBuffer: GPUBuffer;
  public colorBuffer: GPUBuffer;

  // 描画用レイアウト
  public positionBufferLayout: GPUVertexBufferLayout;
  public colorBufferLayout: GPUVertexBufferLayout;

  // パーティクル数
  public particleCount: number;

  public yCount: number;
  public zCount: number;
  public xCount: number;

  constructor(
    device: GPUDevice,
    boxWidth: number,
    boxHeight: number,
    boxDepth: number,
    particleCount: number
  ) {
    this.particleCount = particleCount;
    this.yCount = 100;
    this.zCount = 100;
    this.xCount = particleCount / (this.yCount * this.zCount);

    this.createParticleData(boxWidth, boxHeight, boxDepth, particleCount);
    this.createBuffers(device);
  }

  //パーティクルの範囲は、-boxWidth/2~boxWidth/2, -boxHeight/2~boxHeight/2, -boxDepth/2~boxDepth/2の範囲になる

  createParticleData(
    boxWidth: number,
    boxHeight: number,
    boxDepth: number,
    particleCount: number
  ) {
    this.positions = new Float32Array(particleCount * 4); // xyzw wは0
    this.colors = new Float32Array(particleCount * 4); // rgba

    let index = 0;
    for (let i = 0; i < this.xCount; i++) {
      for (let j = 0; j < this.yCount; j++) {
        for (let k = 0; k < this.zCount; k++) {
          // X, Y, Z座標の中心を0にし、範囲を[-boxWidth/2, boxWidth/2]等にする
          const x = (i / (this.xCount - 1)) * boxWidth - boxWidth / 2;
          const y = (j / (this.yCount - 1)) * boxHeight - boxHeight / 2;
          const z = (k / (this.zCount - 1)) * boxDepth - boxDepth / 2;
          const w = 0.0;

          this.positions[index * 4 + 0] = x;
          this.positions[index * 4 + 1] = y;
          this.positions[index * 4 + 2] = z;
          this.positions[index * 4 + 3] = w;

          const r = Math.random() * 0.5 + 0.2;
          const g = Math.random() * 0.5 + 0.2;
          const b = Math.random() * 0.5 + 0.2;
          const a = 1.0;
          this.colors[index * 4 + 0] = r;
          this.colors[index * 4 + 1] = g;
          this.colors[index * 4 + 2] = b;
          this.colors[index * 4 + 3] = a;

          index++;
        }
      }
    }
  }

  createDescriptor(size: number) {
    const usage: GPUBufferUsageFlags =
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

    const descriptor: GPUBufferDescriptor = {
      size: size,
      usage: usage,
      mappedAtCreation: true,
    };

    return descriptor;
  }

  createBuffers(device: GPUDevice) {
    const positionDescriptor: GPUBufferDescriptor = this.createDescriptor(
      this.positions.byteLength
    );

    const colorDescriptor: GPUBufferDescriptor = this.createDescriptor(
      this.colors.byteLength
    );

    this.positionBuffer = device.createBuffer(positionDescriptor);
    new Float32Array(this.positionBuffer.getMappedRange()).set(this.positions);
    this.positionBuffer.unmap();

    this.colorBuffer = device.createBuffer(colorDescriptor);
    new Float32Array(this.colorBuffer.getMappedRange()).set(this.colors);
    this.colorBuffer.unmap();

    this.positionBufferLayout = {
      arrayStride: 16, // 4 floats for xyzw
      attributes: [
        {
          shaderLocation: 0,
          format: "float32x4",
          offset: 0,
        },
      ],
    };

    this.colorBufferLayout = {
      arrayStride: 16, // 4 floats for rgba
      attributes: [
        {
          shaderLocation: 1,
          format: "float32x4",
          offset: 0,
        },
      ],
    };
  }
}
