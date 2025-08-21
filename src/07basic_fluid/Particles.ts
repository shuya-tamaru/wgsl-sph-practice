export class Particles {
  // パーティクルデータ

  public positions: Float32Array;
  public colors: Float32Array;
  public velocities: Float32Array; // 速度データ（SPH法/重力シミュレーション用）

  // GPUバッファ
  public positionBuffer: GPUBuffer;
  public colorBuffer: GPUBuffer;
  public velocityBuffer: GPUBuffer;
  public particleParamsBuffer: GPUBuffer;
  public densityBuffer: GPUBuffer;
  public pressureBuffer: GPUBuffer;
  public pressureForceBuffer: GPUBuffer;
  public viscosityBuffer: GPUBuffer;

  // 描画用レイアウト
  public positionBufferLayout: GPUVertexBufferLayout;
  public colorBufferLayout: GPUVertexBufferLayout;
  public velocityBufferLayout: GPUVertexBufferLayout;

  public boxWidth: number;
  public boxHeight: number;
  public boxDepth: number;

  public particleCount: number;
  public xCount: number;
  public yCount: number;
  public zCount: number;
  public particleParams: {
    xCount: number;
    yCount: number;
    zCount: number;
    boxWidth: number;
    boxHeight: number;
    boxDepth: number;
    particleCount: number;
    _pad0: number;
  };

  constructor(device: GPUDevice) {
    this.boxWidth = 1.0; // 2D表示に適したサイズ
    this.boxHeight = 1.0;
    this.boxDepth = 1.0; // Z方向は薄く
    this.xCount = 100; // パーティクル数を大幅に削減（デバッグ用）
    this.yCount = 100;
    this.zCount = 1;
    this.particleCount = this.xCount * this.yCount * this.zCount; // 正しいパーティクル数
    this.particleParams = {
      xCount: this.xCount,
      yCount: this.yCount,
      zCount: this.zCount,
      boxWidth: this.boxWidth,
      boxHeight: this.boxHeight,
      boxDepth: this.boxDepth,
      particleCount: this.particleCount,
      _pad0: 0,
    };

    this.createParticleData();
    this.createBuffers(device);
  }

  createParticleData() {
    this.positions = new Float32Array(this.particleCount * 4); // xyzw
    this.velocities = new Float32Array(this.particleCount * 4); // xyzw
    this.colors = new Float32Array(this.particleCount * 4); // rgba
    let index = 0;
    for (let i = 0; i < this.xCount; i++) {
      for (let j = 0; j < this.yCount; j++) {
        for (let k = 0; k < this.zCount; k++) {
          // グリッド状に位置を生成し、中心を0にする
          // パーティクル数が1の場合は中心に配置
          let x, y;
          if (this.xCount === 1) {
            x = 0.0;
          } else {
            x = (i / (this.xCount - 1)) * this.boxWidth - this.boxWidth / 2;
          }

          if (this.yCount === 1) {
            y = 0.0;
          } else {
            y = (j / (this.yCount - 1)) * this.boxHeight - this.boxHeight / 2;
          }

          const z = 0; // Z座標を0に固定して2D平面に配置

          this.positions[index * 4 + 0] = x;
          this.positions[index * 4 + 1] = y;
          this.positions[index * 4 + 2] = z;
          this.positions[index * 4 + 3] = 1.0;

          // 初期速度に少しランダム性を追加
          this.velocities[index * 4 + 0] = (Math.random() - 0.5) * 0.1;
          this.velocities[index * 4 + 1] = (Math.random() - 0.5) * 0.1;
          this.velocities[index * 4 + 2] = (Math.random() - 0.5) * 0.1;
          this.velocities[index * 4 + 3] = 0.0;

          // より鮮やかな色を割り当て
          const r = Math.random() * 0.8 + 0.2;
          const g = Math.random() * 0.8 + 0.2;
          const b = Math.random() * 0.8 + 0.2;
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
    // positionBuffer (元のパーティクルの位置)
    this.positionBuffer = device.createBuffer({
      size: this.positions.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.positionBuffer.getMappedRange()).set(this.positions);
    this.positionBuffer.unmap();

    // colorBuffer（色データ）
    this.colorBuffer = device.createBuffer({
      size: this.colors.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(this.colors);
    this.colorBuffer.unmap();

    this.velocityBuffer = device.createBuffer({
      size: this.velocities.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.velocityBuffer.getMappedRange()).set(this.velocities);
    this.velocityBuffer.unmap();

    this.particleParamsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const particleParamsArray = new ArrayBuffer(32);
    const f32View_particleParams = new Float32Array(particleParamsArray);
    const uint32View_particleParams = new Uint32Array(particleParamsArray);

    uint32View_particleParams[0] = this.particleParams.xCount;
    uint32View_particleParams[1] = this.particleParams.yCount;
    uint32View_particleParams[2] = this.particleParams.zCount;
    f32View_particleParams[3] = this.particleParams.boxWidth;
    f32View_particleParams[4] = this.particleParams.boxHeight;
    f32View_particleParams[5] = this.particleParams.boxDepth;
    uint32View_particleParams[6] = this.particleParams.particleCount;
    uint32View_particleParams[7] = 0;

    device.queue.writeBuffer(this.particleParamsBuffer, 0, particleParamsArray);

    this.densityBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true, // 初期化時にマップ
    });

    // densityBufferを0で初期化
    const initialDensities = new Float32Array(this.particleCount);
    new Float32Array(this.densityBuffer.getMappedRange()).set(initialDensities);
    this.densityBuffer.unmap();

    this.pressureBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true, // 初期化時にマップ
    });

    const initialPressures = new Float32Array(this.particleCount);
    new Float32Array(this.pressureBuffer.getMappedRange()).set(
      initialPressures
    );
    this.pressureBuffer.unmap();

    this.pressureForceBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true, // 初期化時にマップ
    });

    const initialPressureForces = new Float32Array(this.particleCount * 4);
    new Float32Array(this.pressureForceBuffer.getMappedRange()).set(
      initialPressureForces
    );
    this.pressureForceBuffer.unmap();

    this.viscosityBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4, // 1パーティクルあたりvec4 (16バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true, // 初期化時にマップ
    });
    const initialViscosities = new Float32Array(this.particleCount);
    new Float32Array(this.viscosityBuffer.getMappedRange()).set(
      initialViscosities
    );
    this.viscosityBuffer.unmap();

    this.positionBufferLayout = {
      arrayStride: 16, // 4 floats for xyzw
      attributes: [{ shaderLocation: 0, format: "float32x4", offset: 0 }],
    };

    this.colorBufferLayout = {
      arrayStride: 16, // 4 floats for rgba
      attributes: [{ shaderLocation: 1, format: "float32x4", offset: 0 }],
    };

    this.velocityBufferLayout = {
      arrayStride: 16, // 4 floats for xyzw
      attributes: [{ shaderLocation: 2, format: "float32x4", offset: 0 }],
    };
  }
}
