@group(0) @binding(0)
var<uniform> gridCellCount: u32;

@group(0) @binding(1)
var<storage, read> input: array<u32>;

@group(0) @binding(2)
var<storage, read_write> output: array<u32>;


var<workgroup> shared_data: array<u32, 256>;

@compute @workgroup_size(128)
fn cs_main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let i = global_id.x;

    if (i >= gridCellCount) {
        return;
    }
    
    // 共有メモリに値を読み込む
    shared_data[local_id.x] = input[i];
    
    // プレフィックス和を計算
    var offset = 1u;
    while (offset < 128u) {
        let temp = shared_data[local_id.x - offset];
        if (local_id.x >= offset) {
            shared_data[local_id.x] = shared_data[local_id.x] + temp;
        }
        offset *= 2;
    }
    
    // 結果をグローバルメモリに書き戻す
    if (i > 0) {
        output[i] = shared_data[local_id.x - 1];
    } else {
        output[i] = 0;
    }
}