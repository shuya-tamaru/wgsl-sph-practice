struct SPHParams {
  h: f32,
  h2: f32,
  h6: f32,
  h9: f32,
  mass: f32,
  restDensity: f32,
  pressureStiffness: f32,
  viscosity: f32,
};

struct TimeStep {
  dt: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

const GRAVITY: vec3<f32> = vec3<f32>(0.0, -9.8, 0.0);

@group(0) @binding(0) var<storage, read> srcPositions: array<vec4<f32>>;

@group(0) @binding(1) var<storage, read_write> dstPositions: array<vec4<f32>>;

@group(0) @binding(2) var<storage, read> srcVelocities: array<vec4<f32>>;

@group(0) @binding(3) var<storage, read_write> dstVelocities: array<vec4<f32>>;

@group(0) @binding(4) var<storage, read> pressureForce: array<vec4<f32>>;

@group(0) @binding(5) var<storage, read> viscosity: array<vec4<f32>>;

@group(0) @binding(6) var<storage, read> collisionForces: array<vec4<f32>>;

@group(0) @binding(7) var<uniform> sp: SPHParams;

@group(0) @binding(8) var<uniform> ts: TimeStep;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= arrayLength(&srcPositions)) { return; }

  let x = srcPositions[i].xyz;
  let v = srcVelocities[i].xyz;
  let F = pressureForce[i].xyz + viscosity[i].xyz + collisionForces[i].xyz;

  let a = F + GRAVITY;
  // let v_new = v + a * ts.dt;
  // let x_new = x + v_new * ts.dt;
  let x_new = x + v * ts.dt + 0.5 * a * ts.dt * ts.dt ;
  let v_new = v + a * ts.dt;

  dstPositions[i] = vec4<f32>(x_new, 0.0);
  dstVelocities[i] = vec4<f32>(v_new, 0.0);
}