const PI = 3.14159265359;

fn W_Poly6(r: f32, h: f32) -> f32 {
  let r2 = r * r;
  let h2 = h * h;

  if (r2 >= h2) {
    return 0.0;
  }

  //powを避ける
  let c = h2 - r2;
  let c2 = c * c;
  let c3 = c2 * c;
  
  //powを避ける
  let h3 = h2 * h;
  let h6 = h3 * h3;
  let h9 = h6 * h3;
  let coef = 315.0 / (64.0 * PI * h9);

  return coef * c3;
}

struct ParticlesParams {
    particleCount: u32,
    h: f32,
    particleMass: f32,
    restDensity: f32,
    gasConstant: f32,
    viscosity: f32,
    boxSize: vec3<f32>
};

@group(0) @binding(0)
var<uniform> particles_params: ParticlesParams;

@group(0) @binding(1)
var<storage, read> reorderedPositions: array<vec4<f32>>;

@group(0) @binding(2)
var<storage, read> cellStartIndices: array<u32>;

@group(0) @binding(3)
var<storage, read> cellCounts: array<u32>;


@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
  
    if (i >= particles_params.particleCount) {
        return;
    }
}