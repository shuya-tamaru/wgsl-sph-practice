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

struct TimeStep {
  dt: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

const MASS = 1.0;
const RESTITUTION = 0.9;
const TANGENT_DAMPING = 0.1;

@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> velocities: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pressureForces: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> viscosities: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> pp: ParticleParams;
@group(0) @binding(5) var<uniform> ts: TimeStep;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;

  if (i >= pp.particleCount) { 
    return; 
  }
  var pos = positions[i].xy;
  var vel = velocities[i].xy;
  var f = pressureForces[i].xy + viscosities[i].xy;

  let a = f / MASS;

  vel += a * ts.dt;
  pos += vel * ts.dt;

  if (pos.x < -pp.boxWidth) {
    pos.x = -pp.boxWidth;
    let n = vec2<f32>(1.0, 0.0);
    let vn = dot(vel, n) * n;         // 法線成分
    let vt = vel - vn;                 // 接線成分
    vel = (-vn * RESTITUTION) + vt * (1.0 - TANGENT_DAMPING);
  } else if (pos.x > pp.boxWidth) {
    pos.x = pp.boxWidth;
    let n = vec2<f32>(-1.0, 0.0);
    let vn = dot(vel, n) * n;
    let vt = vel - vn;
    vel = (-vn * RESTITUTION) + vt * (1.0 - TANGENT_DAMPING);
  }

  // y 境界
  if (pos.y < -pp.boxHeight) {
    pos.y = -pp.boxHeight;
    let n = vec2<f32>(0.0, 1.0);
    let vn = dot(vel, n) * n;
    let vt = vel - vn;
    vel = (-vn * RESTITUTION) + vt * (1.0 - TANGENT_DAMPING);
  } else if (pos.y > pp.boxHeight) {
    pos.y = pp.boxHeight;
    let n = vec2<f32>(0.0, -1.0);
    let vn = dot(vel, n) * n;
    let vt = vel - vn;
    vel = (-vn * RESTITUTION) + vt * (1.0 - TANGENT_DAMPING);
  }

  positions[i] = vec4<f32>(pos, positions[i].zw);
  velocities[i] = vec4<f32>(vel, velocities[i].zw);
}