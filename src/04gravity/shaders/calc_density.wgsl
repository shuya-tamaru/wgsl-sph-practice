const PI = 3.14159265359;

fn W_Poly6(r_sq: f32, h: f32) -> f32 {
    let h2 = h * h;
    let h6 = h2 * h2 * h2;
    let h9 = h6 * h2 * h;

    if (r_sq > h2 || r_sq < 0.0) {
        return 0.0;
    }

    let h2_minus_r2 = h2 - r_sq;
    let h2_minus_r2_cubed = h2_minus_r2 * h2_minus_r2 * h2_minus_r2;

    // 315 / (64 * PI * h^9)
    let constant = 315.0 / (64.0 * PI * h9);
    return constant * h2_minus_r2_cubed;
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
var<storage, read_write> densities: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
  
    if (i >= particles_params.particleCount) {
        return;
    }
    
    let p_i = reorderedPositions[i];
    
    // このパーティクルが属するグリッドセルのIDを再計算
    let h = particles_params.h;
    let box = particles_params.boxSize;
    let grid_size_x = u32(floor(box.x / h)) + 1u;
    let grid_size_y = u32(floor(box.y / h)) + 1u;
    let grid_size_z = u32(floor(box.z / h)) + 1u;

    // F32で計算し、u32に変換
    let temp_f32_pos = floor(p_i.xyz / h) + box / (2.0 * h);
    let cell_pos_i = vec3<u32>(
        u32(temp_f32_pos.x),
        u32(temp_f32_pos.y),
        u32(temp_f32_pos.z)
    );
    let cell_id_i = cell_pos_i.x + cell_pos_i.y * grid_size_x + cell_pos_i.z * grid_size_x * grid_size_y;
    
    var density_i: f32 = 0.0;

    // 現在のパーティクル自身の密度を初期値として設定
    let h2 = h * h;
    let h6 = h2 * h2 * h2;
    let h9 = h6 * h2 * h;
    density_i += particles_params.particleMass * (315.0 / (64.0 * PI * h9)) * h6;

    // 近傍探索（グリッドセルをループ）
    for (var z_offset: i32 = -1; z_offset <= 1; z_offset++) {
        for (var y_offset: i32 = -1; y_offset <= 1; y_offset++) {
            for (var x_offset: i32 = -1; x_offset <= 1; x_offset++) {
                
                // cell_pos_iをi32にキャストして加算
                let neighbor_cell_pos_i32 = vec3<i32>(cell_pos_i) + vec3<i32>(x_offset, y_offset, z_offset);
                
                // 範囲チェック
                if (any(neighbor_cell_pos_i32 < vec3<i32>(0)) ||
                    neighbor_cell_pos_i32.x >= i32(grid_size_x) ||
                    neighbor_cell_pos_i32.y >= i32(grid_size_y) ||
                    neighbor_cell_pos_i32.z >= i32(grid_size_z)) {
                    continue;
                }

                // 範囲内であればu32に戻す
                let neighbor_cell_pos = vec3<u32>(neighbor_cell_pos_i32);
                let neighbor_cell_id = neighbor_cell_pos.x + neighbor_cell_pos.y * grid_size_x + neighbor_cell_pos.z * grid_size_x * grid_size_y;

                let start_index = cellStartIndices[neighbor_cell_id];
                var end_index = particles_params.particleCount;
                if (neighbor_cell_id + 1 < arrayLength(&cellStartIndices)) {
                    end_index = cellStartIndices[neighbor_cell_id + 1];
                }
                
                // そのグリッドセル内のパーティクルをループ
                for (var j: u32 = start_index; j < end_index; j++) {
                    let p_j = reorderedPositions[j];
                    let r_vec = p_i.xyz - p_j.xyz;
                    let r_sq = dot(r_vec, r_vec);
                    
                    if (r_sq < h * h && r_sq > 0.0) { // 自分自身は除外
                        density_i += particles_params.particleMass * W_Poly6(r_sq, h);
                    }
                }
            }
        }
    }

    densities[i] = density_i;
}