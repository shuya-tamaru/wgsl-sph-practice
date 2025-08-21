struct GridParams {
  particleCount: u32,
  _pad0: u32, 
  _pad1: u32, 
  _pad2: u32,
  gridDim: vec4<u32>,              // x,y,z,unused
  gridMinAndCellSize: vec4<f32>,   // xyz=min, w=cellSize
};

@group(0) @binding(0) var<storage, read_write> cellIndices : array<u32>;

@group(0) @binding(1) var<storage, read_write> cellStartIndices : array<u32>;

@group(0) @binding(2) var<storage, read_write> gridParticleIds : array<u32>;

@group(0) @binding(3) var<storage, read_write> cellWriteCursor : array<atomic<u32>>;

@group(0) @binding(4) var<uniform> gp : GridParams;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= gp.particleCount) { return; }

  let cid = cellIndices[i];

  let ofs = atomicAdd(&cellWriteCursor[cid], 1u);

  let dst = cellStartIndices[cid] + ofs;

  gridParticleIds[dst] = i;
}