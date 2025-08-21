struct SphParams {
  h: f32,
  h2: f32,
  h6: f32,
  h9: f32,
  mass: f32,
  restDensity: f32,
  pressureStiffness: f32,
  viscosity: f32,
};

struct GridParams {
  particleCount: u32,
  _pad0: u32, 
  _pad1: u32, 
  _pad2: u32,
  gridDim: vec4<u32>,              // x,y,z,unused
  gridMinAndCellSize: vec4<f32>,   // xyz=min, w=cellSize
};

const PI: f32 = 3.14159265358979323846;

@group(0) @binding(0) var<storage, read> positions : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> cellStart : array<u32>;
@group(0) @binding(2) var<storage, read> density : array<f32>;
@group(0) @binding(3) var<storage, read> pressure : array<f32>;
@group(0) @binding(4) var<uniform> sp : SphParams;
@group(0) @binding(5) var<uniform> gp : GridParams;
@group(0) @binding(6) var<storage, read_write> force : array<vec4<f32>>;


fn pos_to_cell_coord(p: vec3<f32>) -> vec3<u32> {
  let res = (p - gp.gridMinAndCellSize.xyz) / gp.gridMinAndCellSize.w;
  let cx = clamp(i32(floor(res.x)), 0, i32(gp.gridDim.x) - 1);
  let cy = clamp(i32(floor(res.y)), 0, i32(gp.gridDim.y) - 1);
  let cz = clamp(i32(floor(res.z)), 0, i32(gp.gridDim.z) - 1);
  return vec3<u32>(u32(cx), u32(cy), u32(cz));
}

fn cell_coord_to_index(c: vec3<u32>) -> u32 {
  return c.x + c.y * gp.gridDim.x + c.z * gp.gridDim.x * gp.gridDim.y;
}

fn gradW_spiky_mag(r: f32) -> f32 {
  if (r <= 0.0 || r >= sp.h) { return 0.0; }

  let c = sp.h - r;
  let c2 = c * c;

  let coef = 45.0 / (PI * sp.h6);

  return coef * c2;
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= gp.particleCount) { return; }

  let xi   = positions[i].xyz;
  let rhoi = density[i];
  let pi_  = pressure[i];

  var fi : vec3<f32> = vec3<f32>(0.0);

  let ci = pos_to_cell_coord(xi);
  for (var dz: i32 = -1; dz <= 1; dz++) {
    let z = i32(ci.z) + dz;
    if (z < 0 || z >= i32(gp.gridDim.z)) { continue; }

    for (var dy: i32 = -1; dy <= 1; dy++) {
      let y = i32(ci.y) + dy;
      if (y < 0 || y >= i32(gp.gridDim.y)) { continue; }

      for (var dx: i32 = -1; dx <= 1; dx++) {
        let x = i32(ci.x) + dx;
        if (x < 0 || x >= i32(gp.gridDim.x)) { continue; }

        let nidx  = cell_coord_to_index(vec3<u32>(u32(x), u32(y), u32(z)));
        let start = cellStart[nidx];
        let end   = cellStart[nidx + 1u];

        var j = start;
        loop {
          if (j >= end) { break; }

          let xj   = positions[j].xyz;
          let rvec = xi - xj;
          let r2   = dot(rvec, rvec);

          if (r2 > 0.0 && r2 < sp.h2) {
            let invR = inverseSqrt(r2); 
            let dir  = rvec * invR;
            let r    = 1.0 / invR;
            let grad = gradW_spiky_mag(r) * dir;
            let rhoj = density[j];
            let pj_  = pressure[j];
            let fac = -sp.mass * (pi_/(rhoi*rhoi) + pj_/(rhoj*rhoj));
            fi += fac * grad;
          }

          j += 1u;
        }
      }
    }
  }

  force[i] = vec4<f32>(fi, 0.0);
}