import { WaveMesh } from "./WaveMesh";
import shader from "./shaders/wave_shader.wgsl";
import computeShader from "./shaders/compute_wave.wgsl";

export class Renderer {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  computePipeline: GPUComputePipeline;
  computeBindGroup: GPUBindGroup;

  // Pipeline objects
  bindGroup: GPUBindGroup;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  timeUniformBuffer: GPUBuffer;
  waveParamsBuffer: GPUBuffer;
  heightFieldBuffer: GPUBuffer;
  waveStateBuffer: GPUBuffer;

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
    this.createBuffers();
    await this.createPipeline();

    await this.createComputePipeline();

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

  createBuffers() {
    this.timeUniformBuffer = this.device.createBuffer({
      size: 4, // 4 bytes for time
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.waveParamsBuffer = this.device.createBuffer({
      size: 32, // 32 bytes for wave parameters
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.heightFieldBuffer = this.device.createBuffer({
      size: 4 * this.waveMesh.vertexCount, // 4 bytes for height field
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.waveStateBuffer = this.device.createBuffer({
      size: 4 * 4, // 16 bytes for wave state
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
  }

  async createPipeline() {
    const renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.heightFieldBuffer,
          },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
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
        // topology: "line-list",
        // topology: "point-list",
        // topology: "triangle-list",
        // topology: "triangle-strip",
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

  async createComputePipeline() {
    const computeShaderModule = this.device.createShaderModule({
      code: computeShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }, // waveState
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }, // waveParams
              },
              {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }, // heightField
              },
              {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }, // timeStep
              },
            ],
          }),
        ],
      }),
      compute: {
        module: computeShaderModule,
        entryPoint: "cs_main",
      },
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.waveStateBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.waveParamsBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.heightFieldBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.timeUniformBuffer },
        },
      ],
    });
  }

  render = () => {
    this.t += 0.01;
    const timeInterval = 1 / 100;

    // Update wave time parameter
    const timeData = new Float32Array([this.t]);
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, timeData);

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

    const waveState = new Float32Array([
      this.waveX,
      this.waveY,
      this.speedX,
      this.speedY,
    ]);
    this.device.queue.writeBuffer(this.waveStateBuffer, 0, waveState);

    const waveParams = new Float32Array([
      this.waveLengthX, // waveLengthX
      this.waveLengthY, // waveLengthY
      this.maxHeightX, // maxHeightX
      this.maxHeightY, // maxHeightY
    ]);
    this.device.queue.writeBuffer(this.waveParamsBuffer, 0, waveParams);

    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    const workgroupCount = Math.ceil(this.waveMesh.vertexCount / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

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
