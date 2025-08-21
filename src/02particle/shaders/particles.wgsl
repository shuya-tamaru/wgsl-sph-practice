struct TransformData {
   model: mat4x4<f32>,
   view: mat4x4<f32>,
   projection: mat4x4<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
}

@binding(0) @group(0) var<uniform> transformUBO: TransformData;
@binding(1) @group(0) var<storage, read> heightField: array<f32>;
@binding(2) @group(0) var<storage, read> heightField2: array<f32>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) position: vec3<f32>,
  @location(1) color: vec4<f32>
) -> VertexOutput {
  var output: VertexOutput;
  let height = heightField[vertexIndex];
  let height2 = heightField2[vertexIndex];
  var displacedPos = position;
  displacedPos.y += height + height2;

  output.position = transformUBO.projection * transformUBO.view * transformUBO.model * vec4<f32>(displacedPos, 1.0);
  // output.position = vec4<f32>(displacedPos, 1.0);

  let minHeight: f32 = 0.0;
  let maxHeight: f32 = 40.0; // 仮の最大値。必要に応じて調整
  let t = clamp((height - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
  // 赤から青へのグラデーション
  // 高さによって虹色グラデーションを作る（HSV→RGB変換）


  // 高さに応じて色相を回す。t=0で赤、t=1で紫
  let hue = 0.8 * t; // 0.0～0.8（赤→紫）
  let sat = 0.85;
  let val = 1.0;
  var heightColor = vec3<f32>(1.0, 1.0, 1.0);

  
    let c = val * sat;
    let h_ = hue * 6.0;
    // WGSL does not have mod(), so use h_ - 2.0 * floor(h_ / 2.0)
    let h_mod_2 = h_ - 2.0 * floor(h_ / 2.0);
    let x = c * (1.0 - abs(h_mod_2 - 1.0));
    var rgb = vec3<f32>(0.0, 0.0, 0.0);

    if (h_ < 1.0) {
      rgb = vec3<f32>(c, x, 0.0);
    } else if (h_ < 2.0) {
      rgb = vec3<f32>(x, c, 0.0);
    } else if (h_ < 3.0) {
      rgb = vec3<f32>(0.0, c, x);
    } else if (h_ < 4.0) {
      rgb = vec3<f32>(0.0, x, c);
    } else if (h_ < 5.0) {
      rgb = vec3<f32>(x, 0.0, c);
    } else {
      rgb = vec3<f32>(c, 0.0, x);
    }
    let m = val - c;
    heightColor = rgb + vec3<f32>(m, m, m);
  
  output.color = color;
  return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
