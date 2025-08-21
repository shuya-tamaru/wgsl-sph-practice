export class Square {
  // 四角形の頂点データ（中心を原点とした単位四角形）
  private static readonly vertices = new Float32Array([
    // 位置 (x, y, z, w), テクスチャ座標 (u, v)
    -0.5,
    -0.5,
    0.0,
    1.0,
    0.0,
    0.0, // 左下
    0.5,
    -0.5,
    0.0,
    1.0,
    1.0,
    0.0, // 右下
    0.5,
    0.5,
    0.0,
    1.0,
    1.0,
    1.0, // 右上
    -0.5,
    0.5,
    0.0,
    1.0,
    0.0,
    1.0, // 左上
  ]);

  // インデックスデータ（三角形2つで四角形を構成）
  private static readonly indices = new Uint16Array([
    0,
    1,
    2, // 最初の三角形
    0,
    2,
    3, // 2番目の三角形
  ]);

  // GPUバッファ
  public vertexBuffer: GPUBuffer;
  public indexBuffer: GPUBuffer;

  // 頂点レイアウト
  public vertexBufferLayout: GPUVertexBufferLayout;

  constructor(device: GPUDevice) {
    this.createBuffers(device);
  }

  private createBuffers(device: GPUDevice) {
    // 頂点バッファの作成
    this.vertexBuffer = device.createBuffer({
      size: Square.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(Square.vertices);
    this.vertexBuffer.unmap();

    // インデックスバッファの作成
    this.indexBuffer = device.createBuffer({
      size: Square.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(Square.indices);
    this.indexBuffer.unmap();

    // 頂点レイアウトの設定
    this.vertexBufferLayout = {
      arrayStride: 24, // 6 floats * 4 bytes
      attributes: [
        {
          // 位置
          shaderLocation: 0,
          format: "float32x4",
          offset: 0,
        },
        {
          // テクスチャ座標
          shaderLocation: 1,
          format: "float32x2",
          offset: 16, // 4 floats * 4 bytes
        },
      ],
    };
  }

  // 描画コマンドの実行
  draw(renderPass: GPURenderPassEncoder) {
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, "uint16");
    renderPass.drawIndexed(Square.indices.length);
  }

  // インスタンス描画用の設定
  drawInstanced(renderPass: GPURenderPassEncoder, instanceCount: number) {
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, "uint16");
    // renderPass.drawIndexedInstanced(Square.indices.length, instanceCount);
  }
}
