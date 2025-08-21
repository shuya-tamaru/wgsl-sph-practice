export class Particles {
  // パーティクルデータ

  public positions: Float32Array;
  public velocities: Float32Array; // 速度データ（SPH法/重力シミュレーション用）
  public colors: Float32Array;
  public h: number;
  public h2: number;
  public h6: number;
  public h9: number;
  public mass: number;
  public restDensity: number;
  public pressureStiffness: number;
  public gridCellCount: number;
  public cellSize: number;
  public radius: number;
  public ks: number;
  public kd: number;
  public friction: number;

  // GPUバッファ
  public positionBuffer: GPUBuffer;
  public colorBuffer: GPUBuffer;
  public positionsBufferA: GPUBuffer;
  public positionsBufferB: GPUBuffer;
  public velocitiesBufferA: GPUBuffer;
  public velocitiesBufferB: GPUBuffer;
  public cellCountsBuffer: GPUBuffer;
  public cellStartIndicesBuffer: GPUBuffer;
  public cellIndicesBuffer: GPUBuffer;
  public particleParamsBuffer: GPUBuffer;
  public gridParamsBuffer: GPUBuffer;
  public gridTotalCellCountBuffer: GPUBuffer;
  public gridParticleIdsBuffer: GPUBuffer;
  public cellWriteCursorBuffer: GPUBuffer;
  public sphParamsBuffer: GPUBuffer;
  public pressureBuffer: GPUBuffer;
  public pressureForceBuffer: GPUBuffer;
  public densityBuffer: GPUBuffer;
  public velocityBuffer: GPUBuffer;
  public viscosityBuffer: GPUBuffer;
  public collisionForcesBuffer: GPUBuffer;
  public forcesBuffer: GPUBuffer;
  public collisionParamsBuffer: GPUBuffer;

  // 描画用レイアウト
  public dstPositionsBufferLayout: GPUVertexBufferLayout;
  public colorBufferLayout: GPUVertexBufferLayout;

  // パーティクル数
  public particleCount: number;
  public gridParams: {
    particleCount: number;
    _pad0: number;
    _pad1: number;
    _pad2: number;
    gridDim: { x: number; y: number; z: number; w: number };
    gridMinAndCellSize: { x: number; y: number; z: number; w: number };
  };

  public collisionParams: {
    boxWidth: number;
    boxHeight: number;
    boxDepth: number;
    radius: number;
    ks: number;
    kd: number;
    friction: number;
    _pad0: number;
  };

  public sphParams: {
    h: number;
    h2: number;
    h6: number;
    h9: number;
    mass: number;
    restDensity: number;
    pressureStiffness: number;
    viscosity: number;
  };

  // グリッドの分割数
  public xCount: number;
  public yCount: number;
  public zCount: number;

  public boxWidth: number;
  public boxHeight: number;
  public boxDepth: number;

  // SPH法に必要な物理定数
  public particleMass: number; // 粒子の質量
  public gasConstant: number; // 気体定数
  public viscosity: number; // 粘性係数

  private flipFlg: boolean;

  constructor(device: GPUDevice) {
    this.boxWidth = 35;
    this.boxHeight = 25;
    this.boxDepth = 55;
    this.xCount = 30; // パーティクル数を減らして安定性を向上
    this.yCount = 30;
    this.zCount = 30;
    this.particleCount = this.xCount * this.yCount * this.zCount;

    const particleSpacing = this.boxWidth / (this.xCount - 1);
    this.h = particleSpacing * 1.5; // カーネル半径を調整
    this.cellSize = this.h;

    const cellSize = this.h;
    const cellCountX = Math.ceil(this.boxWidth / cellSize) + 1;
    const cellCountY = Math.ceil(this.boxHeight / cellSize) + 1;
    const cellCountZ = Math.ceil(this.boxDepth / cellSize) + 1;
    this.gridCellCount = cellCountX * cellCountY * cellCountZ;

    this.gridParams = {
      particleCount: this.particleCount,
      _pad0: 0,
      _pad1: 0,
      _pad2: 0,
      gridDim: { x: cellCountX, y: cellCountY, z: cellCountZ, w: 0 },
      gridMinAndCellSize: {
        x: -this.boxWidth / 2,
        y: -this.boxHeight / 2,
        z: -this.boxDepth / 2,
        w: cellSize,
      },
    };

    this.viscosity = 100; // 粘性を増加

    this.h2 = this.h * this.h;
    this.h6 = Math.pow(this.h, 6);
    this.h9 = Math.pow(this.h, 9);
    this.particleMass = 1.0;
    this.pressureStiffness = 200.0; // 圧力の剛性を増加
    this.restDensity = 15000;

    this.radius = 0.01;
    this.ks = 20;
    this.kd = 1.0;
    this.friction = 0.1;

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
          const x = (i / (this.xCount - 1)) * this.boxWidth - this.boxWidth / 2;
          const y =
            (j / (this.yCount - 1)) * this.boxHeight - this.boxHeight / 2;
          const z = (k / (this.zCount - 1)) * this.boxDepth - this.boxDepth / 2;

          this.positions[index * 4 + 0] = x;
          this.positions[index * 4 + 1] = y;
          this.positions[index * 4 + 2] = z;
          this.positions[index * 4 + 3] = 1.0;

          // 初期速度に少しランダム性を追加
          this.velocities[index * 4 + 0] = (Math.random() - 0.5) * 0.1;
          this.velocities[index * 4 + 1] = (Math.random() - 0.5) * 0.1;
          this.velocities[index * 4 + 2] = (Math.random() - 0.5) * 0.1;
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
    // positionBuffer (元のパーティクルの位置)
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

    this.positionsBufferA = device.createBuffer({
      size: this.positions.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.positionsBufferA.getMappedRange()).set(
      this.positions
    );
    this.positionsBufferA.unmap();

    this.positionsBufferB = device.createBuffer({
      size: this.positions.byteLength,
      usage:
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.positionsBufferB.getMappedRange()).set(
      this.positions
    );
    this.positionsBufferB.unmap();

    this.velocitiesBufferA = device.createBuffer({
      size: this.velocities.byteLength,
      usage:
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.velocitiesBufferA.getMappedRange()).set(
      this.velocities
    );
    this.velocitiesBufferA.unmap();

    this.velocitiesBufferB = device.createBuffer({
      size: this.velocities.byteLength,
      usage:
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.velocitiesBufferB.getMappedRange()).set(
      this.velocities
    );
    this.velocitiesBufferB.unmap();

    // colorBuffer（色データ）
    this.colorBuffer = device.createBuffer({
      size: this.colors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(this.colors);
    this.colorBuffer.unmap();

    // cellCountsBuffer（グリッドセルごとのパーティクル数）
    this.cellCountsBuffer = device.createBuffer({
      size: this.gridCellCount * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
    const cellCounts = new Uint32Array(this.gridCellCount);
    cellCounts.fill(0);
    device.queue.writeBuffer(this.cellCountsBuffer, 0, cellCounts);

    // cellStartIndicesBuffer（グリッドセルごとのパーティクルの開始インデックス）
    this.cellStartIndicesBuffer = device.createBuffer({
      size: (this.gridCellCount + 1) * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // cellIndicesBuffer（グリッドセルごとのパーティクルのインデックス）
    this.cellIndicesBuffer = device.createBuffer({
      size: this.particleCount * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.particleParamsBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.gridParamsBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const gridParamsArray = new ArrayBuffer(48);
    const u32View = new Uint32Array(gridParamsArray);
    const f32View = new Float32Array(gridParamsArray);

    u32View[0] = this.gridParams.particleCount; // particleCount
    u32View[1] = 0; // _pad0
    u32View[2] = 0; // _pad1
    u32View[3] = 0; // _pad2
    u32View[4] = this.gridParams.gridDim.x; // gridDim.x
    u32View[5] = this.gridParams.gridDim.y; // gridDim.y
    u32View[6] = this.gridParams.gridDim.z; // gridDim.z
    u32View[7] = 0; // w(_pad)

    f32View[8] = this.gridParams.gridMinAndCellSize.x; // gridMin.x
    f32View[9] = this.gridParams.gridMinAndCellSize.y; // gridMin.y
    f32View[10] = this.gridParams.gridMinAndCellSize.z; // gridMin.z
    f32View[11] = this.cellSize; // cellSize

    device.queue.writeBuffer(this.gridParamsBuffer, 0, gridParamsArray);

    this.gridTotalCellCountBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.gridTotalCellCountBuffer,
      0,
      new Uint32Array([this.gridCellCount])
    );

    this.gridParticleIdsBuffer = device.createBuffer({
      size: this.particleCount * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.cellWriteCursorBuffer = device.createBuffer({
      size: this.gridCellCount * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(
      this.cellWriteCursorBuffer,
      0,
      new Uint32Array(this.gridCellCount)
    );

    this.densityBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.sphParamsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sphParamsArray = new ArrayBuffer(32);
    const f32View_sph = new Float32Array(sphParamsArray);

    f32View_sph[0] = this.h; // h
    f32View_sph[1] = this.h2; // h2
    f32View_sph[2] = this.h6; // h6
    f32View_sph[3] = this.h9; // h9
    f32View_sph[4] = this.particleMass; // mass
    f32View_sph[5] = this.restDensity; // restDensity
    f32View_sph[6] = this.pressureStiffness; // pressureStiffness
    f32View_sph[7] = this.viscosity; // viscosity

    device.queue.writeBuffer(this.sphParamsBuffer, 0, sphParamsArray);

    this.pressureBuffer = device.createBuffer({
      size: this.particleCount * 4, // 1パーティクルあたりfloat1つ (4バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.pressureForceBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4, // 1パーティクルあたりvec4 (16バイト)
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.viscosityBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.velocityBuffer = device.createBuffer({
      size: this.velocities.byteLength,
      usage: GPUBufferUsage.STORAGE, // 頂点バッファとしては使わないためVERTEXは不要
      mappedAtCreation: true,
    });
    new Float32Array(this.velocityBuffer.getMappedRange()).set(this.velocities);
    this.velocityBuffer.unmap();

    this.forcesBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.collisionForcesBuffer = device.createBuffer({
      size: this.particleCount * 4 * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    // バッファレイアウトの定義
    this.dstPositionsBufferLayout = {
      arrayStride: 16, // 4 floats for xyzw
      attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
    };

    this.colorBufferLayout = {
      arrayStride: 16, // 4 floats for rgba
      attributes: [{ shaderLocation: 1, format: "float32x4", offset: 0 }],
    };

    this.collisionParamsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const collisionParamsArray = new ArrayBuffer(32);
    const f32View_collision = new Float32Array(collisionParamsArray);

    f32View_collision[0] = this.boxWidth; // boxWidth
    f32View_collision[1] = this.boxHeight; // boxHeight
    f32View_collision[2] = this.boxDepth; // boxDepth
    f32View_collision[3] = this.radius; // radius
    f32View_collision[4] = this.ks; // ks
    f32View_collision[5] = this.kd; // kd
    f32View_collision[6] = this.friction; // friction
    f32View_collision[7] = 0; // _pad0

    device.queue.writeBuffer(
      this.collisionParamsBuffer,
      0,
      collisionParamsArray
    );
  }

  swapBuffers() {
    this.flipFlg = !this.flipFlg;
  }

  getPositionSrcBuffer() {
    return this.flipFlg ? this.positionsBufferA : this.positionsBufferB;
  }

  getPositionDstBuffer() {
    return this.flipFlg ? this.positionsBufferB : this.positionsBufferA;
  }

  getVelocitySrcBuffer() {
    return this.flipFlg ? this.velocitiesBufferA : this.velocitiesBufferB;
  }

  getVelocityDstBuffer() {
    return this.flipFlg ? this.velocitiesBufferB : this.velocitiesBufferA;
  }
}
