export class Particles {
  // パーティクルデータ
  public positions: Float32Array;
  public velocities: Float32Array; // 速度データ（SPH法/重力シミュレーション用）
  public colors: Float32Array;
  public h: number;
  public gridCellCount: number;

  // GPUバッファ
  public positionBuffer: GPUBuffer;
  public velocityBuffer: GPUBuffer;
  public colorBuffer: GPUBuffer;
  public gridParticleIdsBuffer: GPUBuffer;
  public cellCountsBuffer: GPUBuffer;
  public cellStartIndicesBuffer: GPUBuffer;
  public reorderedPositionsBuffer: GPUBuffer;
  public reorderedVelocitiesBuffer: GPUBuffer;

  // 描画用レイアウト
  public positionBufferLayout: GPUVertexBufferLayout;
  public colorBufferLayout: GPUVertexBufferLayout;

  // パーティクル数
  public particleCount: number;

  // グリッドの分割数
  public xCount: number;
  public yCount: number;
  public zCount: number;

  // SPH法に必要な物理定数
  public particleMass: number; // 粒子の質量
  public restDensity: number; // 基準密度 (水の密度など)
  public gasConstant: number; // 気体定数
  public viscosity: number; // 粘性係数

  // SPH計算用の新しいバッファ
  public densityBuffer: GPUBuffer;
  public pressureBuffer: GPUBuffer;
  public forceBuffer: GPUBuffer;

  constructor(
    device: GPUDevice,
    boxWidth: number,
    boxHeight: number,
    boxDepth: number,
    xCount: number,
    yCount: number,
    zCount: number
  ) {
    this.xCount = xCount;
    this.yCount = yCount;
    this.zCount = zCount;
    this.particleCount = xCount * yCount * zCount;
    this.h = 2.5;
    const cellSize = this.h;
    const grid_size_x = Math.ceil(boxWidth / cellSize) + 1;
    const grid_size_y = Math.ceil(boxHeight / cellSize) + 1;
    const grid_size_z = Math.ceil(boxDepth / cellSize) + 1;
    this.gridCellCount = grid_size_x * grid_size_y * grid_size_z;

    this.particleMass = 0.0002;
    this.restDensity = 1000.0;
    this.gasConstant = 2000.0;
    this.viscosity = 0.1;

    this.createParticleData(boxWidth, boxHeight, boxDepth);
    this.createBuffers(device);
  }

  createParticleData(boxWidth: number, boxHeight: number, boxDepth: number) {
    this.positions = new Float32Array(this.particleCount * 4); // xyzw
    this.velocities = new Float32Array(this.particleCount * 4); // xyzw
    this.colors = new Float32Array(this.particleCount * 4); // rgba

    let index = 0;
    for (let i = 0; i < this.xCount; i++) {
      for (let j = 0; j < this.yCount; j++) {
        for (let k = 0; k < this.zCount; k++) {
          // グリッド状に位置を生成し、中心を0にする
          const x = (i / (this.xCount - 1)) * boxWidth - boxWidth / 2;
          const y = (j / (this.yCount - 1)) * boxHeight - boxHeight / 2;
          const z = (k / (this.zCount - 1)) * boxDepth - boxDepth / 2;

          this.positions[index * 4 + 0] = x;
          this.positions[index * 4 + 1] = y;
          this.positions[index * 4 + 2] = z;
          this.positions[index * 4 + 3] = 1.0;

          // 初期速度はすべて0
          this.velocities[index * 4 + 0] = 0.0;
          this.velocities[index * 4 + 1] = 0.0;
          this.velocities[index * 4 + 2] = 0.0;
          this.velocities[index * 4 + 3] = 0.0;

          // ランダムな色を割り当て
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

  createBuffers(device: GPUDevice) {
    // positionBuffer (Compute Shaderで読み書きするためSTORAGEフラグを追加)
    this.positionBuffer = device.createBuffer({
      size: this.positions.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(this.positionBuffer.getMappedRange()).set(this.positions);
    this.positionBuffer.unmap();

    // velocityBuffer (Compute Shaderで読み書きするためSTORAGEフラグを追加)
    this.velocityBuffer = device.createBuffer({
      size: this.velocities.byteLength,
      usage: GPUBufferUsage.STORAGE, // 頂点バッファとしては使わないためVERTEXは不要
      mappedAtCreation: true,
    });
    new Float32Array(this.velocityBuffer.getMappedRange()).set(this.velocities);
    this.velocityBuffer.unmap();

    // colorBuffer
    this.colorBuffer = device.createBuffer({
      size: this.colors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(this.colors);
    this.colorBuffer.unmap();

    this.gridParticleIdsBuffer = device.createBuffer({
      size: this.particleCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cellCountsBuffer = device.createBuffer({
      size: this.gridCellCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cellStartIndicesBuffer = device.createBuffer({
      size: this.gridCellCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.densityBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.pressureBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.forceBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4, // 1パーティクルあたりvec4 (16バイト)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // バッファレイアウトの定義
    this.positionBufferLayout = {
      arrayStride: 16, // 4 floats for xyzw
      attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
    };

    this.colorBufferLayout = {
      arrayStride: 16, // 4 floats for rgba
      attributes: [{ shaderLocation: 1, format: "float32x4", offset: 0 }],
    };

    this.reorderedPositionsBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST,
    });

    this.reorderedVelocitiesBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
}
