import { mat4 } from "gl-matrix";
import { OrbitControls } from "../OrbitControls";

export class TransformManager {
  private canvas: HTMLCanvasElement;
  private orbitControls: OrbitControls;

  // Matrix storage
  private modelMatrix: mat4;
  private viewMatrix: mat4;
  private projectionMatrix: mat4;

  constructor(canvas: HTMLCanvasElement, orbitControls: OrbitControls) {
    this.canvas = canvas;
    this.orbitControls = orbitControls;

    // Initialize matrices
    this.modelMatrix = mat4.create();
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
  }

  updateMatrices(): {
    model: Float32Array;
    view: Float32Array;
    projection: Float32Array;
  } {
    this.updateProjectionMatrix();
    this.updateViewMatrix();
    this.updateModelMatrix();

    return {
      model: new Float32Array(this.modelMatrix),
      view: new Float32Array(this.viewMatrix),
      projection: new Float32Array(this.projectionMatrix),
    };
  }

  private updateProjectionMatrix(): void {
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 2, aspect, 0.1, 500);
  }

  private updateViewMatrix(): void {
    this.orbitControls.updateCamera();
    const viewMatrix = this.orbitControls.getViewMatrix();
    mat4.copy(this.viewMatrix, viewMatrix);
  }

  private updateModelMatrix(): void {
    // Reset to identity matrix (no transformation for now)
    mat4.identity(this.modelMatrix);
    // Could add model transformations here if needed
  }

  // Utility methods for getting individual matrices
  getModelMatrix(): mat4 {
    return mat4.clone(this.modelMatrix);
  }

  getViewMatrix(): mat4 {
    return mat4.clone(this.viewMatrix);
  }

  getProjectionMatrix(): mat4 {
    return mat4.clone(this.projectionMatrix);
  }

  // Method to handle canvas resize
  handleResize(): void {
    this.updateProjectionMatrix();
  }

  // Method to get combined MVP matrix if needed
  getMVPMatrix(): mat4 {
    const mvp = mat4.create();
    mat4.multiply(mvp, this.projectionMatrix, this.viewMatrix);
    mat4.multiply(mvp, mvp, this.modelMatrix);
    return mvp;
  }
}
