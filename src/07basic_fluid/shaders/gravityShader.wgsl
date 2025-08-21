struct TimeStep {
  dt: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

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

const COLLISION_DAMPING = 1.0;

@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;

@group(0) @binding(1) var<storage, read_write> velocities: array<vec4<f32>>;

@group(0) @binding(2) var<uniform> ts: TimeStep;

@group(0) @binding(3) var<uniform> pp: ParticleParams;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= pp.particleCount) { 
    return; 
  }
  
  let p = positions[index];
  let v = velocities[index];

  var new_v = v + vec4<f32>(0.0, -9.8 * ts.dt, 0.0, 0.0);
  var new_p = p.xyz + new_v.xyz * ts.dt;
  // X方向の境界判定
  if (abs(new_p.x) > pp.boxWidth) {
    new_p.x = pp.boxWidth * sign(new_p.x);
    new_v.x *= -1.0 * COLLISION_DAMPING;
  }

  if (abs(new_p.y) > pp.boxHeight) {
    new_p.y = pp.boxHeight * sign(new_p.y);
    new_v.y *= -1.0 * COLLISION_DAMPING;
  }


  // Z方向の境界判定（2Dなら不要だが一応）
  if (abs(new_p.z) > pp.boxDepth) {
    new_p.z = pp.boxDepth * sign(new_p.z);
    new_v.z *= -1.0 * COLLISION_DAMPING;
  }



  positions[index] = vec4<f32>(new_p, p.w);
  velocities[index] = new_v;
}