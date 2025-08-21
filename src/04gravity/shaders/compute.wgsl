@group(0) @binding(0)
var<uniform> timeStep: f32;

@group(0) @binding(1)
var<uniform> boxSize: vec3<f32>;

@group(0) @binding(2) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> velocities: array<vec4<f32>>; 
// @group(0) @binding(4) var<storage, read_write> gravity: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
  
  // パーティクルが配列の範囲内に収まっているかチェック
  if (index >= arrayLength(&positions)) {
      return;
  }
  
  // 重力加速度
  let gravity = vec3<f32>(0.0, -9.8, 0.0);
  
  // 現在の位置と速度を取得
  var position = positions[index].xyz;
  var velocity = velocities[index].xyz;
  
  // 速度に重力を加算
  velocity = velocity + gravity * timeStep;
  
  // 位置を更新
  position = position + velocity * timeStep;

  // 壁との衝突判定（今回はy軸の地面のみ）
  // boxHeight / 2 が床のy座標
  if (position.y < -boxSize.y / 2.0) {
      position.y = -boxSize.y / 2.0; // 地面に位置を戻す
      velocity.y = -velocity.y * 0.8; // 跳ね返りをシミュレート（0.8は反発係数）
  }
  
  // 更新された位置と速度をストレージバッファに書き戻す
  positions[index] = vec4<f32>(position, 1.0);
  velocities[index] = vec4<f32>(velocity, 1.0);
}