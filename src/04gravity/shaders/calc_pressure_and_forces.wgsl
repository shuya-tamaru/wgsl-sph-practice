// src/shaders/calc_pressure_and_forces.wgsl
const PI = 3.14159265359;
const G_CONST = 9.8; // 重力加速度

// SPHカーネル関数の勾配 (Spiky Kernelの勾配)
fn W_Spiky_Grad(r_vec: vec3<f32>, r: f32, h: f32) -> vec3<f32> {
    let h2 = h * h;
    let h6 = h2 * h2 * h2;

    if (r > h || r < 0.0001) { // rが非常に小さい場合も除外
        return vec3<f32>(0.0);
    }
    
    let h_minus_r = h - r;
    let h_minus_r_sq = h_minus_r * h_minus_r;
    let constant = -45.0 / (PI * h6);
    
    return constant * h_minus_r_sq * normalize(r_vec);
}

// 粘性カーネル関数の勾配
fn W_Viscosity_Laplacian(r: f32, h: f32) -> f32 {
    let h2 = h * h;
    let h3 = h2 * h;
    let h6 = h3 * h3;

    if (r > h || r < 0.0) {
        return 0.0;
    }
    
    let h_minus_r = h - r;
    let constant = 45.0 / (PI * h6);

    return constant * h_minus_r;
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

// 読み込み専用のバッファ
@group(0) @binding(1) var<storage, read> reorderedPositions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> reorderedVelocities: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> densities: array<f32>;
@group(0) @binding(4) var<storage, read> cellStartIndices: array<u32>;

// 書き込み先のバッファ
@group(0) @binding(5) var<storage, read_write> pressures: array<f32>;
@group(0) @binding(6) var<storage, read_write> forces: array<vec4<f32>>;


@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
  
    if (i >= particles_params.particleCount) {
        return;
    }

    let p_i = reorderedPositions[i];
    let v_i = reorderedVelocities[i];
    let density_i = densities[i];

    // STEP 1: 圧力の計算 (状態方程式)
    let pressure_i = max(0.0, particles_params.gasConstant * (density_i - particles_params.restDensity));
    pressures[i] = pressure_i;
    
    // STEP 2: 力の計算
    var pressure_force: vec3<f32> = vec3<f32>(0.0);
    var viscosity_force: vec3<f32> = vec3<f32>(0.0);
    
    // 近傍探索（calc_density.wgslからコピーしたロジック）
    let h = particles_params.h;
    let box = particles_params.boxSize;
    let grid_size_x = u32(floor(box.x / h)) + 1u;
    let grid_size_y = u32(floor(box.y / h)) + 1u;
    let grid_size_z = u32(floor(box.z / h)) + 1u;

    let temp_f32_pos = floor(p_i.xyz / h) + box / (2.0 * h);
    let cell_pos_i = vec3<u32>(
        u32(temp_f32_pos.x),
        u32(temp_f32_pos.y),
        u32(temp_f32_pos.z)
    );

    for (var z_offset: i32 = -1; z_offset <= 1; z_offset++) {
        for (var y_offset: i32 = -1; y_offset <= 1; y_offset++) {
            for (var x_offset: i32 = -1; x_offset <= 1; x_offset++) {
                
                let neighbor_cell_pos_i32 = vec3<i32>(cell_pos_i) + vec3<i32>(x_offset, y_offset, z_offset);
                
                if (any(neighbor_cell_pos_i32 < vec3<i32>(0)) ||
                    neighbor_cell_pos_i32.x >= i32(grid_size_x) ||
                    neighbor_cell_pos_i32.y >= i32(grid_size_y) ||
                    neighbor_cell_pos_i32.z >= i32(grid_size_z)) {
                    continue;
                }
                let neighbor_cell_pos = vec3<u32>(neighbor_cell_pos_i32);
                let neighbor_cell_id = neighbor_cell_pos.x + neighbor_cell_pos.y * grid_size_x + neighbor_cell_pos.z * grid_size_x * grid_size_y;

                let start_index = cellStartIndices[neighbor_cell_id];
                var end_index = particles_params.particleCount;
                if (neighbor_cell_id + 1 < arrayLength(&cellStartIndices)) {
                    end_index = cellStartIndices[neighbor_cell_id + 1];
                }

                for (var j: u32 = start_index; j < end_index; j++) {
                    let p_j = reorderedPositions[j];
                    let v_j = reorderedVelocities[j];
                    let density_j = densities[j];
                    let pressure_j = pressures[j];
                    
                    let r_vec = p_i.xyz - p_j.xyz;
                    let r = length(r_vec);

                    if (r < h && r > 0.0) {
                        // 圧力による力
                        let P_ij = - (pressure_i + pressure_j) / (2.0 * density_j);
                        let W_grad_val = W_Spiky_Grad(r_vec, r, h);
                        pressure_force += particles_params.particleMass * P_ij * W_grad_val;
                        
                        // 粘性による力
                        let V_ij = v_j.xyz - v_i.xyz;
                        let W_lap_val = W_Viscosity_Laplacian(r, h);
                        viscosity_force += particles_params.particleMass * particles_params.viscosity * (V_ij / density_j) * W_lap_val;
                    }
                }
            }
        }
    }
    
    // 重力
    let gravity_force = vec3<f32>(0.0, -G_CONST * density_i, 0.0);
    
    let total_force = pressure_force + viscosity_force + gravity_force;
    
    forces[i] = vec4<f32>(total_force, 0.0);
}