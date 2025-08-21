struct TransformData {
   model: mat4x4<f32>,
   view: mat4x4<f32>,
   projection: mat4x4<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
}

@binding(0) @group(0) var<uniform> timeStep: f32;
@binding(1) @group(0) var<uniform> transformUBO: TransformData;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) position: vec4<f32>,
  @location(1) color: vec4<f32>,
  @location(2) velocity: vec4<f32>
) -> VertexOutput {
  var output: VertexOutput;

  output.position = position;
  // 速度の大きさを計算
  let speed: f32 = length(velocity.xyz);

  

  // 速度の範囲を仮定（調整可能）
  let minSpeed: f32 = 0.0;
  let maxSpeed: f32 = 1.3;
  // より映える色のグラデーション（紫→青→シアン→緑→黄→オレンジ→赤→ピンク）
  let t: f32 = clamp((speed - minSpeed) / (maxSpeed - minSpeed), 0.0, 1.0);

  var gradColor: vec3<f32>;
  if (t < 0.15) {
    // 紫→青
    let localT = t / 0.15;
    gradColor = mix(vec3<f32>(0.6, 0.0, 1.0), vec3<f32>(0.0, 0.2, 1.0), localT);
  } else if (t < 0.30) {
    // 青→シアン
    let localT = (t - 0.15) / 0.15;
    gradColor = mix(vec3<f32>(0.0, 0.2, 1.0), vec3<f32>(0.0, 1.0, 1.0), localT);
  } else if (t < 0.45) {
    // シアン→緑
    let localT = (t - 0.30) / 0.15;
    gradColor = mix(vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(0.0, 1.0, 0.2), localT);
  } else if (t < 0.60) {
    // 緑→黄
    let localT = (t - 0.45) / 0.15;
    gradColor = mix(vec3<f32>(0.0, 1.0, 0.2), vec3<f32>(1.0, 1.0, 0.0), localT);
  } else if (t < 0.75) {
    // 黄→オレンジ
    let localT = (t - 0.60) / 0.15;
    gradColor = mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.5, 0.0), localT);
  } else if (t < 0.90) {
    // オレンジ→赤
    let localT = (t - 0.75) / 0.15;
    gradColor = mix(vec3<f32>(1.0, 0.5, 0.0), vec3<f32>(1.0, 0.0, 0.0), localT);
  } else {
    // 赤→ピンク
    let localT = (t - 0.90) / 0.10;
    gradColor = mix(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(1.0, 0.0, 0.7), localT);
  }

  // output.color = vec4<f32>(gradColor, color.a);
  output.color = vec4<f32>(1.0,1.0,0.0, color.a);
  
  return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
