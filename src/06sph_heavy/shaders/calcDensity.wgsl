const PI = 3.14159265359;

struct SphParams {
  h: f32,
  h2: f32,
  h9: f32,
  mass: f32,
};

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
var<storage, read> cellStartIndices: array<u32>;

@group(0) @binding(2)
var<uniform> gp: GridParams;

@group(0) @binding(3)
var<uniform> sp: SphParams;

@group(0) @binding(4)
var<storage, read_write> density: array<f32>;


fn W_Poly6(r2: f32) -> f32 {
  if (r2 >= sp.h2) {
    return 0.0;
  }
  //powを避ける
  let c = sp.h2 - r2;
  let c2 = c * c;
  let c3 = c2 * c;
  
  //powを避ける
  let coef = 315.0 / (64.0 * PI * sp.h9);

  return coef * c3;
}

fn pos_to_cell_coord(p: vec3<f32>) -> vec3<u32> {
  let resolution = (p - gp.gridMinAndCellSize.xyz) / gp.gridMinAndCellSize.w;
  let cx = i32(floor(resolution.x));
  let cy = i32(floor(resolution.y));
  let cz = i32(floor(resolution.z));

  let cxc = clamp(cx, 0, i32(gp.gridDim.x) - 1);
  let cyc = clamp(cy, 0, i32(gp.gridDim.y) - 1);
  let czc = clamp(cz, 0, i32(gp.gridDim.z) - 1);

  return vec3<u32>(u32(cx), u32(cy), u32(cz));
}

fn cell_coord_to_index(c: vec3<u32>) -> u32 {
  return c.x + c.y * gp.gridDim.x + c.z * gp.gridDim.x * gp.gridDim.y;
}


@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
  
    if (i >= gp.particleCount) {
        return;
    }

    let pi = positions[i].xyz; 
    var rho: f32 = 0.0;

    let ci = pos_to_cell_coord(pi);

    for(var dz: i32 = -1; dz <= 1; dz++) {
      let z = i32(ci.z) + dz;
      if(z < 0 || z >= i32(gp.gridDim.z)) {
        continue;
      }
      for(var dy: i32 = -1; dy <= 1; dy++) {
        let y = i32(ci.y) + dy;
        if(y < 0 || y >= i32(gp.gridDim.y)) {
          continue;
        } 
        for(var dx: i32 = -1; dx <= 1; dx++) {
          let x = i32(ci.x) + dx;
          if(x < 0 || x >= i32(gp.gridDim.x)) {
            continue;
          }

          let nc = vec3<u32>(u32(x), u32(y), u32(z));
          let nidx = cell_coord_to_index(nc);
          let start = cellStartIndices[nidx];
          let end   = cellStartIndices[nidx + 1u];

          var j = start;
          loop {
            if (j >= end) { break; }
            let pj = positions[j].xyz;
            let r  = pi - pj;
            let r2 = dot(r, r);

            if (r2 < sp.h2) {
              rho = rho + sp.mass * W_Poly6(r2);
            }
            j = j + 1u;
          }
        }
      }
    }
    
    density[i] = rho;
}