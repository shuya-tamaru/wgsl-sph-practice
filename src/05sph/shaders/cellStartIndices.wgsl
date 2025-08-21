struct GridParams {
  particleCount: u32,
  _pad0: u32, 
  _pad1: u32, 
  _pad2: u32,
  gridDim: vec4<u32>,              // x,y,z,unused
  gridMinAndCellSize: vec4<f32>,   // xyz=min, w=cellSize
};

@group(0) @binding(0)
var<storage, read_write> cellCounts : array<atomic<u32>>;

@group(0) @binding(1)
var<storage, read_write> cellStart : array<u32>;

@group(0) @binding(2)
var<uniform> gp : GridParams;

@compute @workgroup_size(1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  // 1スレッドだけで実行
  if (gid.x > 0u) { return; }

  let cellCount = gp.gridDim.x * gp.gridDim.y * gp.gridDim.z;

  var acc: u32 = 0u;
  cellStart[0u] = 0u;

  var c: u32 = 0u;
  loop {
    if (c >= cellCount) { break; }
    let cnt = atomicLoad(&(cellCounts[c]));
    acc += cnt;
    cellStart[c + 1u] = acc;
    c += 1u;
  }
}
