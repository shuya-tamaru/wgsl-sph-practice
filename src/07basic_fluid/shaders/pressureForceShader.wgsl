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

const PRESSURE_STIFFNESS = 1;
const REST_DENSITY = 1.0;
const PI = 3.14159265358979323846;
const MASS = 1.0;
const SMOOTHING_RADIUS = 0.5;

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> pressures: array<f32>;
@group(0) @binding(2) var<storage, read> densities: array<f32>;
@group(0) @binding(3) var<storage, read_write> pressureForces: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> pp: ParticleParams;

fn spikyGrad2D(h: f32, rij: vec2<f32>) -> vec2<f32> {
  let r = length(rij);
  if (r <= 0.0 || r >= h) { return vec2<f32>(0.0); }
  let scale = -30.0 / (PI * pow(h, 5.0)); // 2Dの正規化
  let factor = scale * (h - r) * (h - r) / r;
  return factor * rij; // 方向付き ∇W
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;

  if (i >= pp.particleCount) { 
    return; 
  }

  let xi = positions[i].xy;
  let pi = pressures[i];
  var rhoi = REST_DENSITY;

  if (arrayLength(&densities) > 0u) { 
    rhoi = densities[i]; 
  }

  var f = vec2<f32>(0.0);

  for (var j: u32 = 0u; j < pp.particleCount; j++) {
    if (j == i) { continue; }
    let rij = xi - positions[j].xy;
    let gradW = spikyGrad2D(SMOOTHING_RADIUS, rij);
    if (all(gradW == vec2<f32>(0.0))) { continue; }
    let pj   = pressures[j];
    var rhoj = REST_DENSITY;
    if (arrayLength(&densities) > 0u) { 
      rhoj = densities[j]; 
    }

    let term = (pi / (rhoi * rhoi)) + (pj / (rhoj * rhoj));
    f += -MASS * term * gradW;  // m * term * ∇W
  }

  pressureForces[i] = vec4<f32>(f, 0.0, 0.0);
}