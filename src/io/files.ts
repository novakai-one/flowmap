/* =====================================================================
   files.ts — save / load .mmd files
   ---------------------------------------------------------------------
   Responsibility: download the current diagram as a .mmd text file and
   load a .mmd/.txt file back in (reading it, applying the text, and
   fitting the view). Thin glue over mermaid.toMermaid + applyText.
   ===================================================================== */

import type { AppContext } from '../core/context';
import type { MermaidApi } from './mermaid';
import type { CameraApi } from '../core/camera';

export interface FilesApi {
  saveMmd: () => void;
}

export function initFiles(ctx: AppContext, mermaid: MermaidApi, camera: CameraApi): FilesApi {
  const { mmd } = ctx.dom;

  function downloadBlob(blob: Blob, name: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function saveMmd(): void {
    downloadBlob(new Blob([mermaid.toMermaid()], { type: 'text/plain' }), 'diagram.mmd');
  }

  // wire the hidden file input
  const loadInput = document.getElementById('loadInput') as HTMLInputElement | null;
  if (loadInput) {
    loadInput.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { mmd.value = rd.result as string; mermaid.applyText(); camera.zoomToFit(); };
      rd.readAsText(f);
      (e.target as HTMLInputElement).value = '';
    };
  }

  return { saveMmd };
}
