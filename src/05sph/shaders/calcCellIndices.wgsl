struct GridParams {
  particleCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  gridDim: vec4<u32>,
  gridMinAndCellSize: vec4<f32>,
};

@group(0) @binding(0)
var<storage, read> positions: array<vec4<f32>>;

@group(0) @binding(1)
var<storage, read_write> cellCounts: array<atomic<u32>>;

@group(0) @binding(2)
var<storage, read_write> cellIndices: array<u32>;

@group(0) @binding(3)
var<uniform> gp: GridParams;

fn pos_to_cell_index(p: vec3<f32>) -> u32 {
  let resolution = (p - gp.gridMinAndCellSize.xyz) / gp.gridMinAndCellSize.w;
  let cx = i32(floor(resolution.x));
  let cy = i32(floor(resolution.y));
  let cz = i32(floor(resolution.z));

  let cxc = clamp(cx, 0, i32(gp.gridDim.x) - 1);
  let cyc = clamp(cy, 0, i32(gp.gridDim.y) - 1);
  let czc = clamp(cz, 0, i32(gp.gridDim.z) - 1);

  return u32(cxc)
      + u32(cyc) * gp.gridDim.x
      + u32(czc) * gp.gridDim.x * gp.gridDim.y;
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= gp.particleCount) { return; }

  let pos = positions[i].xyz;
  let cid = pos_to_cell_index(pos);
  cellIndices[i] = cid;
  atomicAdd(&(cellCounts[cid]), 1u);
}

//memo pos_to_cell_index example
// gp.gridMin      = (-5.0, -5.0, -5.0)   // グリッドの最小座標
// gp.cellSize     = 1.0                   // 1セルの物理サイズ
// gp.gridDim      = (10, 10, 10)          // X, Y, Z方向のセル数
// p = (1.3, 0.7, -3.8)
// resolution = (p - gp.gridMin) / gp.cellSize
//            = ( (1.3 + 5.0), (0.7 + 5.0), (-3.8 + 5.0) ) / 1.0
//            = (6.3, 5.7, 1.2)
//cx = floor(6.3) = 6
// cy = floor(5.7) = 5
// cz = floor(1.2) = 1
//cxc = clamp(6, 0, 9) = 6
// cyc = clamp(5, 0, 9) = 5
// czc = clamp(1, 0, 9) = 1  
//index = u32(cxc)
// + u32(cyc) * gp.gridDim.x
// + u32(czc) * gp.gridDim.x * gp.gridDim.y

// = 6
// + 5 * 10
// + 1 * 10 * 10

// = 6 + 50 + 100
// = 156