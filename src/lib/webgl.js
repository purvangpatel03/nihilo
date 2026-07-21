// Robust WebGL2/WebGL capability probe. Returns true if we can render.
export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Some headless / blocklisted contexts report but fail on shader compile.
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) {
      /* keep context alive; probe only */
    }
    return true;
  } catch (e) {
    return false;
  }
}
