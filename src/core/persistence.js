/* =====================================================================
   persistence.ts — autosave + prefs storage
   ---------------------------------------------------------------------
   Responsibility: read/write the model and the camera to localStorage
   (debounced), restore them on boot, and load/save the Prefs object.
   This is the only module that touches the autosave/pref storage keys.
   It mutates ctx.state / ctx.cam / ctx.prefs in place on load.
   ===================================================================== */
import { LS_KEY, PREF_KEY } from './config';
import { normalizeFrontmatter } from './frontmatter';
export function initPersistence(ctx) {
    const { state, cam } = ctx;
    let persistTimer = null;
    function persist() {
        if (persistTimer !== null)
            clearTimeout(persistTimer);
        persistTimer = window.setTimeout(() => {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify({
                    nodes: state.nodes, edges: state.edges, nid: state.nid, eid: state.eid, dir: state.dir, cam,
                }));
            }
            catch { /* storage may be unavailable; ignore */ }
        }, 400);
    }
    function loadPersisted() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw)
                return false;
            const s = JSON.parse(raw);
            if (!s.nodes || !Object.keys(s.nodes).length)
                return false;
            state.nodes = s.nodes;
            state.edges = s.edges;
            state.nid = s.nid || 1;
            state.eid = s.eid || 1;
            state.dir = s.dir || 'TD';
            // migrate any frontmatter saved before the interfaces refactor
            for (const n of Object.values(state.nodes)) {
                if (n.fm)
                    n.fm = normalizeFrontmatter(n.fm);
            }
            if (s.cam) {
                cam.x = s.cam.x;
                cam.y = s.cam.y;
                cam.z = s.cam.z;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    return { persist, loadPersisted };
}
/** Load persisted prefs over the supplied defaults (mutates `prefs`). */
export function loadPrefs(prefs) {
    try {
        const raw = localStorage.getItem(PREF_KEY);
        if (raw)
            Object.assign(prefs, JSON.parse(raw));
    }
    catch { /* ignore */ }
}
/** Persist prefs. */
export function savePrefs(prefs) {
    try {
        localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    }
    catch { /* ignore */ }
}
