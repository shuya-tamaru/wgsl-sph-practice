struct GridCounts {
  xCount: u32,
  yCount: u32,
  zCount: u32,
}

@group(0) @binding(0)
var<storage, read_write> heightField: array<f32>;

@group(0) @binding(1)
var<uniform> timeStep: f32;

@group(0) @binding(2)
var<uniform> gridCounts: GridCounts;

@group(0) @binding(3)
var<uniform> boxSize: vec3<f32>;

@group(0) @binding(4)
var<storage, read_write> velocity: array<vec4<f32>>;

@group(0) @binding(5)
var<storage, read_write> positions: array<vec4<f32>>;



@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let N: u32 = gridCounts.xCount * gridCounts.yCount * gridCounts.zCount;
  let index: u32 = global_id.x;
  if (index >= N) { return; }

  var pos = positions[index];
  var vel = velocity[index];

  // 速度更新
  vel.y += -9.8 * timeStep;

  // 位置更新（1回だけ）
  pos.x += vel.x * timeStep;
  pos.y += vel.y * timeStep;
  pos.z += vel.z * timeStep;

  // 底面バウンス
  let minY = -0.5 * boxSize.y;
  if (pos.y < minY) {
    pos.y = minY;
    if (vel.y < 0.0) {
      vel.y = -vel.y * 0.6;
    }
  }

  // ★必ず書き戻す
  positions[index] = pos;
  velocity[index] = vel;
}
