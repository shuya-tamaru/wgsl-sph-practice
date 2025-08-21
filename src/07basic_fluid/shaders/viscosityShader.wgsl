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

const PI = 3.14159265358979323846;
const MASS = 1.0;
const VISCOSITY_MU = 0.01;
const SMOOTHING_RADIUS = 0.5;

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> velocities: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> densities: array<f32>;
@group(0) @binding(3) var<storage, read_write> viscosities: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> pp: ParticleParams;

fn viscosityLaplacian2D(h: f32, r: f32) -> f32 {
  if (r >= h) { return 0.0; }
  let h2 = h * h;
  let h3 = h2 * h;
  let h4 = h3 * h;
  let h5 = h4 * h;

  return 40.0 / (PI * h5) * (h - r);
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= pp.particleCount) { return; }

  let xi = positions[i].xy;
  let vi = velocities[i].xy;

  var f_visc = vec2<f32>(0.0);
  for (var j: u32 = 0u; j < pp.particleCount; j++) {
    if (j == i) { continue; }
    let rij_vec = xi - positions[j].xy;
    let r = length(rij_vec);
    if (r <= 0.0 || r >= SMOOTHING_RADIUS) { continue; }

    let vj   = velocities[j].xy;
    let rhoj = densities[j];

    let lap = viscosityLaplacian2D(SMOOTHING_RADIUS, r); // scalar
    f_visc += VISCOSITY_MU * MASS * ((vj - vi) / rhoj) * lap;
  }

  viscosities[i] = vec4<f32>(f_visc, 0.0, 0.0);
}