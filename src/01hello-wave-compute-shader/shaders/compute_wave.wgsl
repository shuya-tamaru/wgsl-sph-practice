struct WaveState {
  waveX: f32,
  waveY: f32,
  speedX: f32,
  speedY: f32,
}

struct WaveParams {
  waveLengthX: f32,
  waveLengthY: f32,
  maxHeightX: f32,
  maxHeightY: f32,
}


@group(0) @binding(0)
var<storage, read_write> waveState: WaveState;

@group(0) @binding(1)
var<uniform> waveParams: WaveParams;

@group(0) @binding(2)
var<storage, read_write> heightField: array<f32>;

@group(0) @binding(3)
var<uniform> timeStep: f32;

fn accumulate_wave(
  waveCenter: f32,
  waveLength: f32,
  maxHeight: f32,
  index: u32,
  bufferSize: u32
) -> f32 {
  let quarterWaveLength = 0.25 * waveLength;
  let pos = (f32(index) + 0.5) / f32(bufferSize);

  var mirroredCenter: f32;
  if (waveCenter < 0.0) {
    mirroredCenter = -waveCenter;
  } else if (waveCenter > 1.0) {
    mirroredCenter = 2.0 - waveCenter;
  } else {
    mirroredCenter = waveCenter;
  }

  let distance = abs(pos - mirroredCenter);
  if distance > quarterWaveLength {
    return 0.0;
  }

  let theta = min((distance * 3.14159265359) / quarterWaveLength, 3.14159265359);
  return maxHeight * 0.5 * (cos(theta) + 1.0);
}


@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let bufferSize = arrayLength(&heightField);
  if (index >= bufferSize) {
    return;
  }

  var h: f32 = 0.0;
  h += accumulate_wave(waveState.waveX, waveParams.waveLengthX, waveParams.maxHeightX, index, bufferSize);
  h += accumulate_wave(waveState.waveY, waveParams.waveLengthY, waveParams.maxHeightY, index, bufferSize);
  heightField[index] = h;
}
