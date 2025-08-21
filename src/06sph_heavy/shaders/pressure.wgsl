struct SphParams {
  h: f32,
  h2: f32,
  h6: f32,
  h9: f32,
  mass: f32,
  restDensity: f32,
  pressureStiffness: f32,
  viscosity: f32,
};

@group(0) @binding(0) var<storage, read> density: array<f32>;

@group(0) @binding(1) var<uniform> sp: SphParams;

@group(0) @binding(2) var<storage, read_write> pressure: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= arrayLength(&density)) { return; }

  let rho = density[i];
  let p = sp.pressureStiffness * max(0.0, rho - sp.restDensity);
  pressure[i] = p;
}