struct Fragment {
    @builtin(position) Position: vec4<f32>,
    @location(0) Color: vec4<f32>,
};

@group(0) @binding(0)
var<storage, read> heightField: array<f32>;

@vertex
fn vs_main(
    @builtin(vertex_index) vertexIndex: u32,
    @location(0) vertexPosition: vec3<f32>,
    @location(1) vertexColor: vec3<f32>
) -> Fragment {
    var output: Fragment;

    let height = heightField[vertexIndex];
    var displacedPos = vertexPosition;
    displacedPos.y += height;

    output.Position = vec4<f32>(displacedPos, 1.0);

    let minHeight = 0.0;
    let maxHeight = 1.0;
    let color1 = vec3<f32>(0.0, 0.2, 1.0);
    let color2 = vec3<f32>(1.0, 1.0, 0.0);
    let t = clamp((height - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
    let color = mix(color1, color2, t);
    output.Color = vec4<f32>(color, 1.0);

    return output;
}

@fragment
fn fs_main(@location(0) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}
