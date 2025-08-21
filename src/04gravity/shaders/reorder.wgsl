@group(0) @binding(0)
var<uniform> timeStep: f32; // バインドグループを統一するため残す

@group(0) @binding(1)
var<storage, read> gridParticleIds: array<u32>;

@group(0) @binding(2)
var<storage, read> cellStartIndices: array<u32>;

@group(0) @binding(3)
var<storage, read> positions: array<vec4<f32>>; // 書き込み可能に

@group(0) @binding(4)
var<storage, read> velocities: array<vec4<f32>>; // 書き込み可能に

@group(0) @binding(5)
var<storage, read_write> reorderedPositions: array<vec4<f32>>;

@group(0) @binding(6)
var<storage, read_write> reorderedVelocities: array<vec4<f32>>;


@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
  
    // if (index >= particleCount) {
    //     return;
    // }
    
    let grid_cell_id = gridParticleIds[index];
    let cell_start_index = cellStartIndices[grid_cell_id];

    // このパーティクルの新しいソート後のインデックスを計算
    // ここでは単純化のため、グリッドIDとパーティクルIDのペアのソートは省略
    // 実際にはもっと複雑なソートアルゴリズムが必要だが、まずはシンプルな実装から
    let new_index = cell_start_index + (index - cell_start_index); // これは間違った計算方法
    
    // 正しい実装のためのヒント:
    // このステップでは、グリッドIDのソート結果に基づいてインデックスを決定する
    // ...
    
    // 今はまだソートが不完全なため、以下のロジックはデバッグ用
    let new_position = positions[index];
    let new_velocity = velocities[index];

    // 並び替えたデータを新しいバッファに書き込む
    reorderedPositions[index] = new_position;
    reorderedVelocities[index] = new_velocity;
}