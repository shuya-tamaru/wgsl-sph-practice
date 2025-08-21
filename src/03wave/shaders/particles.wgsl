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
@binding(1) @group(0) var<storage, read> positions: array<vec4<f32>>;

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) position: vec4<f32>,
  @location(1) color: vec4<f32>
) -> VertexOutput {
  var output: VertexOutput;
  // compute shaderで更新された位置を使用
  let posData = positions[vertexIndex];
  let worldPos = vec3<f32>(posData.x, posData.y, posData.z);

  output.position = transformUBO.projection * transformUBO.view * transformUBO.model * vec4<f32>(worldPos, 1.0);
  output.color = color;
  
  return output;
}

@fragment
fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
