@group(0) @binding(0)
var<uniform> timeStep: f32;

@group(0) @binding(1)
var<uniform> gridParticleCount: u32;

@group(0) @binding(2)
var<storage, read> gridParticleIds: array<u32>;

@group(0) @binding(3)
var<storage, read_write> cellCounts: array<atomic<u32>>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    
    if (index >= arrayLength(&gridParticleIds)) {
        return;
    }
    
    let grid_cell_id = gridParticleIds[index];
    
    if (grid_cell_id >= gridParticleCount) {
        return;
    }

    atomicAdd(&cellCounts[grid_cell_id], 1);
}