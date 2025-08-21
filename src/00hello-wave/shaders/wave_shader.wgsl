struct TransformData {
   model: mat4x4<f32>,
   view: mat4x4<f32>,
   projection: mat4x4<f32>,
}

struct Fragment {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec4<f32>
};

struct WaveState {
  x: f32,
  speed: f32,
}

struct WaveParams {
  waveX: f32,
  waveY: f32,
  speedX: f32,
  speedY: f32,
  waveLengthX: f32,
  waveLengthY: f32,
  maxHeightX: f32,
  maxHeightY: f32,
}


@binding(0) @group(0) var<uniform> transformUBO: TransformData;
@binding(1) @group(0) var<uniform> time: f32;
@binding(2) @group(0) var<uniform> waveParams: WaveParams;
@binding(3) @group(0) var<storage, read> heightField: array<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32,@location(0) vertexPosition: vec3<f32>, @location(1) vertexColor: vec3<f32>) -> Fragment {
    var output : Fragment;
    let height = heightField[vertexIndex];
    var pos = vertexPosition;
    pos.y += height;

    let minHeight = 0.0;
    let maxHeight = 1.0;
    const color1 = vec3<f32>(0.0, 0.2, 1.0);
    const color2 = vec3<f32>(1.0, 1.0, 0.0);
    let t = clamp((height - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
    let color = mix(color1, color2, t);

    output.Position = vec4<f32>(pos, 1.0);
    output.Color = vec4<f32>(color, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}