struct CollisionParams {
  boxWidth: f32,
  boxHeight: f32,
  boxDepth: f32,
  radius: f32,
  ks: f32,
  kd: f32,
  friction: f32,
  _pad0: f32,
};

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;

@group(0) @binding(1) var<storage, read> velocities: array<vec4<f32>>;

@group(0) @binding(2) var<storage, read_write> collisionForces: array<vec4<f32>>;

@group(0) @binding(3) var<uniform> cp: CollisionParams;


fn collide_plane(p: vec3<f32>, v: vec3<f32>, n: vec3<f32>, planePos: f32, radius: f32,
                 ks: f32, kd: f32, friction: f32) -> vec3<f32> {
  // n はボックス内向きの法線（例：左面なら +X）
  // 面までの signed 距離（n 方向の位置 − 面位置）
  let signedDist = dot(p, n) - planePos;
  // 粒子の半径ぶん内側がしきい値
  let depth = radius - signedDist;   // depth>0 で食い込み
  if (depth <= 0.0) { return vec3<f32>(0.0); }

  // 法線方向ダンピング（内向き法線 n への速度成分）
  let vn   = dot(v, n);
  let Fn   = ks * depth - kd * vn;   // vn<0(壁へ突っ込み)で増える
  var F    = n * Fn;

  // 接線摩擦（簡易な粘性摩擦）
  let v_t  = v - vn * n;
  F += -friction * v_t;

  return F;
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= arrayLength(&positions)) { return; }
  
  let p = positions[i].xyz;
  let v = velocities[i].xyz;

  let hx = 0.5 * cp.boxWidth;
  let hy = 0.5 * cp.boxHeight;
  let hz = 0.5 * cp.boxDepth;

  var F = vec3<f32>(0.0);

  // 左面 (x = -hx) 法線 +X、面位置は dot([x,y,z], n)= -hx
  F += collide_plane(p, v, vec3<f32>( 1.0, 0.0, 0.0), -hx, cp.radius, cp.ks, cp.kd, cp.friction);
  // 右面 (x = +hx) 法線 -X、面位置 +hx
  F += collide_plane(p, v, vec3<f32>(-1.0, 0.0, 0.0),  hx, cp.radius, cp.ks, cp.kd, cp.friction);

  // 下(-hy)/上(+hy)
  F += collide_plane(p, v, vec3<f32>(0.0, 1.0, 0.0), -hy, cp.radius, cp.ks, cp.kd, cp.friction);
  // F += collide_plane(p, v, vec3<f32>(0.0,-1.0, 0.0),  hy, cp.radius, cp.ks, cp.kd, cp.friction);

  // 奥(-hz)/手前(+hz)
  F += collide_plane(p, v, vec3<f32>(0.0, 0.0, 1.0), -hz, cp.radius, cp.ks, cp.kd, cp.friction);
  F += collide_plane(p, v, vec3<f32>(0.0, 0.0,-1.0),  hz, cp.radius, cp.ks, cp.kd, cp.friction);

  // accumulate
  let prev = collisionForces[i].xyz;
  collisionForces[i] = vec4<f32>(prev + F, 0.0);
}