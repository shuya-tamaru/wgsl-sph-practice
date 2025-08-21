import { WaveMesh } from "./WaveMesh";
import { mat4 } from "gl-matrix";
import shader from "./shaders/wave_shader.wgsl";

export class Renderer {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;

  // Pipeline objects
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  timeUniformBuffer: GPUBuffer;
  waveUniformBuffer: GPUBuffer;
  heightFieldBuffer: GPUBuffer;

  waveX: number = 0.0;
  waveY: number = 1.0;
  speedX: number = 1.5;
  speedY: number = -1.0;
  waveLengthX: number = 0.8;
  waveLengthY: number = 1.2;
  maxHeightX: number = 0.5;
  maxHeightY: number = 0.4;

  waveMesh: WaveMesh;
  t: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.t = 0;
  }

  async init() {
    await this.setupDevice();

    this.createAssets();

    await this.createPipeline();

    this.render();
  }

  async setupDevice() {
    this.adapter = (await navigator.gpu.requestAdapter()) as GPUAdapter;
    this.device = (await this.adapter.requestDevice()) as GPUDevice;
    const context = this.canvas.getContext("webgpu");
    if (!context) {
      throw new Error("WebGPU context not supported");
    }
    this.context = context as unknown as GPUCanvasContext;
    this.format = "bgra8unorm";
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });
  }

  async createPipeline() {
    this.uniformBuffer = this.device.createBuffer({
      size: 64 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Wave uniform buffer (waveX, waveY, speedX, speedY, waveLengthX, waveLengthY, maxHeightX, maxHeightY, time)
    this.timeUniformBuffer = this.device.createBuffer({
      size: 4, // 4 bytes for time
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.waveUniformBuffer = this.device.createBuffer({
      size: 32, // 32 bytes for wave parameters
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.heightFieldBuffer = this.device.createBuffer({
      size: 4 * this.waveMesh.vertexCount, // 4 bytes for height field
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.timeUniformBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.waveUniformBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.heightFieldBuffer,
          },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "vs_main",
        buffers: [this.waveMesh.bufferLayout],
      },

      fragment: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: "fs_main",
        targets: [
          {
            format: this.format,
          },
        ],
      },

      primitive: {
        topology: "line-strip",
      },

      layout: pipelineLayout,
    });
  }

  createAssets() {
    this.waveMesh = new WaveMesh(this.device);
  }

  updateWave(x: number, speed: number, timeInterval: number): [number, number] {
    x += timeInterval * speed;

    if (x > 1.0) {
      speed *= -1;
      x = 1.0 + timeInterval * speed;
    } else if (x < -1.0) {
      speed *= -1;
      x = -1.0 + timeInterval * speed;
    }

    return [x, speed];
  }

  accumulateWaveToHeightField(
    x: number,
    waveLength: number,
    maxHeight: number,
    heightField: Float32Array
  ) {
    const kBufferSize = heightField.length; //波を構成する頂点の数
    const quarterWaveLength = 0.25 * waveLength; //波長さの1/4を影響範囲とする（中心からの影響範囲）。
    const start = Math.floor((x - quarterWaveLength) * kBufferSize);
    const end = Math.floor((x + quarterWaveLength) * kBufferSize);

    for (let i = start; i < end; i++) {
      let iNew = i;
      if (i < 0) {
        iNew = -i - 1;
      } else if (i >= kBufferSize) {
        iNew = 2 * kBufferSize - i - 1;
      }

      const distance = Math.abs((i + 0.5) / kBufferSize - x);
      const theta = Math.min((distance * Math.PI) / quarterWaveLength, Math.PI);
      const height = maxHeight * 0.5 * (Math.cos(theta) + 1.0);

      heightField[iNew] += height;
    }
  }

  render = () => {
    this.t += 0.01;
    const timeInterval = 1 / 100;

    [this.waveX, this.speedX] = this.updateWave(
      this.waveX,
      this.speedX,
      timeInterval
    );
    [this.waveY, this.speedY] = this.updateWave(
      this.waveY,
      this.speedY,
      timeInterval
    );

    // Update wave time parameter
    const timeData = new Float32Array([this.t]);
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, timeData);
    const heightField = new Float32Array(this.waveMesh.vertexCount).fill(0);
    this.accumulateWaveToHeightField(
      this.waveX,
      this.waveLengthX,
      this.maxHeightX,
      heightField
    );
    this.accumulateWaveToHeightField(
      this.waveY,
      this.waveLengthY,
      this.maxHeightY,
      heightField
    );

    this.device.queue.writeBuffer(this.heightFieldBuffer, 0, heightField);

    const waveParams = new Float32Array([
      this.waveX, // waveX
      this.waveY, // waveY
      this.speedX, // speedX
      this.speedY, // speedY
      0.8, // waveLengthX
      1.2, // waveLengthY
      0.5, // maxHeightX
      0.4, // maxHeightY
    ]);
    this.device.queue.writeBuffer(this.waveUniformBuffer, 0, waveParams);

    const projection = mat4.create();
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(projection, Math.PI / 2, aspect, 0.1, 10);

    const view = mat4.create();
    mat4.lookAt(view, [0, 0, 2], [0, 0, 0], [0, 1, 0]);

    const model = mat4.create();
    // mat4.rotate(model, model, this.t, [0, 0, 1]); // 回転を停止

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array(model).buffer
    );
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      64,
      new Float32Array(view).buffer
    );
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      128,
      new Float32Array(projection).buffer
    );
    //command encoder: records draw commands for submission
    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();
    //texture view: image view to the color buffer in this case
    const textureView: GPUTextureView = this.context
      .getCurrentTexture()
      .createView();
    //renderpass: holds draw commands, allocated from command encoder
    const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderpass.setPipeline(this.pipeline);
    renderpass.setVertexBuffer(0, this.waveMesh.buffer);
    renderpass.setBindGroup(0, this.bindGroup);
    renderpass.draw(this.waveMesh.vertexCount, 1, 0, 0);
    renderpass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(this.render);
  };
}
