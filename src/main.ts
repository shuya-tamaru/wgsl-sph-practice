// import { Renderer } from "./00hello-wave/renderer";
// import { Renderer } from "./01hello-wave-compute-shader/renderer";
// import { Renderer } from "./02particle/renderer";
// import { Renderer } from "./03wave/renderer";
// import { Renderer } from "./04gravity/renderer";
// import { Renderer } from "./05sph/renderer";
// import { Renderer } from "./06sph_heavy/renderer";
import { Renderer } from "./07basic_fluid/renderer";

const canvas: HTMLCanvasElement = <HTMLCanvasElement>(
  document.getElementById("gfx-main")
);

// パフォーマンス監視の設定（シンプル版）
const urlParams = new URLSearchParams(window.location.search);
const enablePerformance = urlParams.get("perf") !== "false"; // デフォルトで有効

// Set canvas size to match window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Initial resize
resizeCanvas();

// Handle window resize
window.addEventListener("resize", resizeCanvas);

const renderer = new Renderer(canvas);

renderer.init();
