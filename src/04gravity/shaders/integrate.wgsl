// src/shaders/integrate.wgsl
const PI = 3.14159265359;
const G_CONST = 9.8;

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
var<uniform> time_step: f32; // 時間ステップ

// 読み込み専用のバッファ
@group(0) @binding(2) var<storage, read> forces: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reorderedPositions: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reorderedVelocities: array<vec4<f32>>;

// 書き込み先のバッファ（元のバッファに書き込む）
@group(0) @binding(5) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> velocities: array<vec4<f32>>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
  
    if (i >= particles_params.particleCount) {
        return;
    }
    
    let mass = particles_params.particleMass;
    let box_size = particles_params.boxSize;
    let pos_i = reorderedPositions[i].xyz;
    let vel_i = reorderedVelocities[i].xyz;
    let force_i = forces[i].xyz;

    // 運動方程式 F = ma より、加速度を計算
    let acceleration = force_i / mass;

    // 速度を更新 (verlet積分)
    let new_vel = vel_i + acceleration * time_step;

    // 位置を更新
    let new_pos = pos_i + new_vel * time_step;

    // 境界条件の適用
    let bounce = 0.5; // 跳ね返り係数
    let min_bound = -box_size / 2.0;
    let max_bound = box_size / 2.0;

    var final_pos = new_pos;
    var final_vel = new_vel;
    
    // x軸
    if (final_pos.x < min_bound.x) {
        final_pos.x = min_bound.x;
        final_vel.x = -final_vel.x * bounce;
    }
    if (final_pos.x > max_bound.x) {
        final_pos.x = max_bound.x;
        final_vel.x = -final_vel.x * bounce;
    }
    // y軸
    if (final_pos.y < min_bound.y) {
        final_pos.y = min_bound.y;
        final_vel.y = -final_vel.y * bounce;
    }
    if (final_pos.y > max_bound.y) {
        final_pos.y = max_bound.y;
        final_vel.y = -final_vel.y * bounce;
    }
    // z軸
    if (final_pos.z < min_bound.z) {
        final_pos.z = min_bound.z;
        final_vel.z = -final_vel.z * bounce;
    }
    if (final_pos.z > max_bound.z) {
        final_pos.z = max_bound.z;
        final_vel.z = -final_vel.z * bounce;
    }

    // 元のバッファに書き戻す
    positions[i] = vec4<f32>(final_pos, 1.0);
    velocities[i] = vec4<f32>(final_vel, 0.0);
}