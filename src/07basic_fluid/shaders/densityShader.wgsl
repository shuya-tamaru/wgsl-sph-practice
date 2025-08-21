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

const RADIUS = 1.0;
const MASS = 1.0;
const PI = 3.14159265358979323846;


fn smoothingKernel(radius: f32, dist2: f32) -> f32 {
  let r2 = radius * radius;
  let r4 = r2 * r2;
  let r8 = r4 * r4;
  let volume = PI * r8 / 4.0;
  let value = max(0.0, r2 - dist2);
  return value * value * value / volume;
}

@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> densities: array<f32>;
@group(0) @binding(2) var<uniform> pp: ParticleParams;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= pp.particleCount) { 
    return; 
  }

  let p = positions[index].xyz;
  var density = 0.0;

  for(var i: u32 = 0; i < pp.particleCount; i++) {
    if (i == index) { continue; }

    let dp = p - positions[i].xyz;
    let dist2 = dot(dp, dp);
    let influence = smoothingKernel(RADIUS, dist2);
    let c = MASS * influence;
    density += c;
  }

  densities[index] = density;
}