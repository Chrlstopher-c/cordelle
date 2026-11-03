// Diagnostic : nom du moteur de rendu WebGL, « software » si la webview tourne sans GPU.
import { useMemo } from "react";

export function useGpuRenderer(): string {
  return useMemo(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "indisponible";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  }, []);
}
