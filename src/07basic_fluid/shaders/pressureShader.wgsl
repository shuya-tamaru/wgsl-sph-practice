struct ParticleParams {
  xCount: u32,
  yCount: u32,
  zCount: u32,
  boxWidth: f32,
  boxHeight: f32,
  boxDepth: f32,
  particleCount: u32,
  _pad0: u32,
};

const PRESSURE_STIFFNESS = 1.0;
const REST_DENSITY = 1.0;
const PI = 3.14159265358979323846;

@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> pressures: array<f32>;
@group(0) @binding(2) var<storage, read_write> densities: array<f32>;
@group(0) @binding(3) var<uniform> pp: ParticleParams;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= pp.particleCount) { 
    return; 
  }

  let density = densities[index];
  var pressure = 0.0;

  let pressureValue = PRESSURE_STIFFNESS * (density - REST_DENSITY);
  pressures[index] = max(pressureValue, 0.0);
}