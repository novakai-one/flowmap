/* =====================================================================
   files.ts — save / load .mmd files
   ---------------------------------------------------------------------
   Responsibility: download the current diagram as a .mmd text file and
   load a .mmd/.txt file back in (reading it, applying the text, and
   fitting the view). Thin glue over mermaid.toMermaid + applyText.
   ===================================================================== */
export function initFiles(ctx, mermaid, camera) {
    const { mmd } = ctx.dom;
    function downloadBlob(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function saveMmd() {
        downloadBlob(new Blob([mermaid.toMermaid()], { type: 'text/plain' }), 'diagram.mmd');
    }
    // wire the hidden file input
    const loadInput = document.getElementById('loadInput');
    if (loadInput) {
        loadInput.onchange = (e) => {
            const f = e.target.files?.[0];
            if (!f)
                return;
            const rd = new FileReader();
            rd.onload = () => { mmd.value = rd.result; mermaid.applyText(); camera.zoomToFit(); };
            rd.readAsText(f);
            e.target.value = '';
        };
    }
    return { saveMmd };
}
