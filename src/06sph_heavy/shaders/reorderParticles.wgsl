struct GridParams {
  particleCount: u32,
  _pad0: u32, 
  _pad1: u32, 
  _pad2: u32,
  gridDim: vec4<u32>,              // x,y,z,unused
  gridMinAndCellSize: vec4<f32>,   // xyz=min, w=cellSize
};

@group(0) @binding(0) var<storage, read> srcPositions : array<vec4<f32>>;

@group(0) @binding(1) var<storage, read_write> dstPositions : array<vec4<f32>>;

@group(0) @binding(2) var<storage, read> srcVelocities : array<vec4<f32>>;

@group(0) @binding(3) var<storage, read_write> dstVelocities : array<vec4<f32>>;

@group(0) @binding(4) var<storage, read> gridParticleIds : array<u32>;

@group(0) @binding(5) var<uniform> gp : GridParams;

@compute @workgroup_size(128)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= gp.particleCount) { return; }

  let srcIndex = gridParticleIds[i];  
  dstPositions[i] = srcPositions[srcIndex];
  dstVelocities[i] = srcVelocities[srcIndex];
}