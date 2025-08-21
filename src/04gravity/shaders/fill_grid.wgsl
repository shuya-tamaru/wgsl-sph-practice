@group(0) @binding(0)
var<uniform> timeStep: f32; // 今回は使用しないが、バインドグループを統一するため残しておく

@group(0) @binding(1)
var<uniform> boxSize: vec3<f32>;

@group(0) @binding(2) var<storage, read> positions: array<vec4<f32>>;

// 新しいバッファ: グリッドセルIDとパーティクルIDのペアを格納
@group(0) @binding(3) var<storage, read_write> grid_particle_ids: array<u32>;
// @group(0) @binding(4) は次のステップで使います

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
  
    if (index >= arrayLength(&positions)) {
        return;
    }
    
    let h = 5.0;
    
    // グリッドセルのサイズ
    let cell_size = h;
    
    // パーティクルの位置を取得
    let position = positions[index].xyz;

    // グリッドセルの座標を計算
    let cell_x = floor((position.x + boxSize.x / 2.0) / cell_size);
    let cell_y = floor((position.y + boxSize.y / 2.0) / cell_size);
    let cell_z = floor((position.z + boxSize.z / 2.0) / cell_size);

    // 1次元のグリッドセルIDに変換
    let grid_size_x = u32(boxSize.x / cell_size) + 1;
    let grid_size_y = u32(boxSize.y / cell_size) + 1;
    let grid_size_z = u32(boxSize.z / cell_size) + 1;

    let grid_cell_id = u32(cell_z) * grid_size_x * grid_size_y + u32(cell_y) * grid_size_x + u32(cell_x);

    grid_particle_ids[index] = grid_cell_id;
}