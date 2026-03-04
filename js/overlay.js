"use strict";

// ---------------------------------------------------------------------------
// overlay.js  –  Multi-algorithm path overlay visualisation
// ---------------------------------------------------------------------------
// Public API:
//   show_overlay(resultsMap)   – wipe exploration dots, draw wire paths,
//                                build & show legend.
//   clear_overlay()            – remove SVG wires, reset cells, hide legend.
//
// Wire rendering
// --------------
// Each algorithm is drawn as a thin SVG wire that follows the actual path
// direction:
//   • Straight horizontal run  →  wire runs flat across the cell
//   • Straight vertical run    →  wire runs top-to-bottom
//   • 90° corner               →  smooth quadratic bézier bend
//
// All 6 algorithms are assigned fixed lane indices (0-5) so they always sit
// in the same perpendicular slot relative to the path centre, even when the
// number of present algorithms changes.  Lane offset formula:
//   laneOffset = (laneIndex + 1 - (TOTAL_LANES+1)/2) × (cellSize/(TOTAL_LANES+1))
//
// Bézier control point for 90° turns
// -----------------------------------
// For a turn from a horizontal segment ending at A to a vertical segment
// starting at B the control point is (B.x, A.y) – the intersection of the
// two tangent lines.  This produces a quarter-circle-like arc that is
// tangent to the incoming direction at A and to the outgoing direction at B.
// ---------------------------------------------------------------------------

var ALGO_COLORS = {
    'DFS':      '#FF8C00',   // orange
    'BFS':      '#00AEEF',   // sky blue
    'AStar_h1': '#50C850',   // lime green
    'AStar_h2': '#A03CC8',   // purple
    'MDP_VI':   '#DC3232',   // red
    'MDP_PI':   '#00B4A0',   // teal
};

var ALGO_LABELS = {
    'DFS':      'DFS',
    'BFS':      'BFS',
    'AStar_h1': 'A* h1 (Manhattan)',
    'AStar_h2': 'A* h2 (Corridor-Aware)',
    'MDP_VI':   'MDP Value Iteration',
    'MDP_PI':   'MDP Policy Iteration',
};

// Canonical order – lane indices are FIXED regardless of which algos ran
var ALGO_ORDER  = ['DFS', 'BFS', 'AStar_h1', 'AStar_h2', 'MDP_VI', 'MDP_PI'];
var TOTAL_LANES = ALGO_ORDER.length;   // always 6

// ---------------------------------------------------------------------------
// _get_cell_size  –  pixel width of one grid cell (read from DOM at runtime)
// ---------------------------------------------------------------------------
function _get_cell_size() {
    var sample = document.querySelector('#my_table td.cell');
    if (!sample) return null;
    return sample.getBoundingClientRect().width;
}

// ---------------------------------------------------------------------------
// _dir  –  direction string between two adjacent cells
//   'E' (+col), 'W' (-col), 'S' (+row), 'N' (-row)
// ---------------------------------------------------------------------------
function _dir(from, to) {
    var dx = to[0] - from[0];
    var dy = to[1] - from[1];
    if (dx > 0) return 'E';
    if (dx < 0) return 'W';
    if (dy > 0) return 'S';
    return 'N';
}

// ---------------------------------------------------------------------------
// _apply_offset  –  shift a point perpendicular to its direction of travel.
//   E/W (horizontal) travel → perp is vertical  → shift  y
//   N/S (vertical)   travel → perp is horizontal → shift x
// ---------------------------------------------------------------------------
function _apply_offset(px, py, direction, laneOffset) {
    if (direction === 'E' || direction === 'W')
        return [px, py + laneOffset];
    else
        return [px + laneOffset, py];
}

// ---------------------------------------------------------------------------
// _wire_path_d  –  SVG 'd' attribute string for one algorithm's wire.
//
//   path       : [[col,row], …]  grid coordinates (JS convention: col=x, row=y)
//   cs         : cell size in pixels
//   laneOffset : signed perpendicular offset in pixels for this algo's lane
// ---------------------------------------------------------------------------
function _wire_path_d(path, cs, laneOffset) {
    if (!path || path.length < 2) return '';

    var half = cs / 2;

    // ── Build waypoints ────────────────────────────────────────────────────
    // Waypoints are edge midpoints between consecutive cells, plus the centres
    // of the first and last cells (anchors that look clean around start/end icons).
    //
    // Each waypoint carries { pt:[x,y], dir:string } where dir is the direction
    // of travel at that point (used for offset axis and corner bézier logic).

    var waypoints = [];

    for (var i = 0; i < path.length; i++) {
        var curr = path[i];
        var prev = i > 0             ? path[i - 1] : null;
        var next = i < path.length-1 ? path[i + 1] : null;

        var entryDir = prev ? _dir(prev, curr) : null;
        var exitDir  = next ? _dir(curr, next)  : null;

        var cx = curr[0] * cs + half;
        var cy = curr[1] * cs + half;

        if (i === 0) {
            // Start cell: anchor at centre, offset by exit direction
            var pt = _apply_offset(cx, cy, exitDir, laneOffset);
            waypoints.push({ pt: pt, dir: exitDir });

        } else if (i === path.length - 1) {
            // End cell: anchor at centre, offset by entry direction
            var pt = _apply_offset(cx, cy, entryDir, laneOffset);
            waypoints.push({ pt: pt, dir: entryDir });

        } else {
            // Interior cell: insert entry edge midpoint then exit edge midpoint.
            // For straight-through cells they collapse to the same point but
            // the duplicate 'L' is harmless.

            // Entry edge midpoint – shared boundary between prev and curr
            var reX = (curr[0] + prev[0] + 1) * half;
            var reY = (curr[1] + prev[1] + 1) * half;
            var entryPt = _apply_offset(reX, reY, entryDir, laneOffset);
            waypoints.push({ pt: entryPt, dir: entryDir });

            // Exit edge midpoint – shared boundary between curr and next
            var rxX = (curr[0] + next[0] + 1) * half;
            var rxY = (curr[1] + next[1] + 1) * half;
            var exitPt = _apply_offset(rxX, rxY, exitDir, laneOffset);
            waypoints.push({ pt: exitPt, dir: exitDir });
        }
    }

    // ── Render SVG path string ─────────────────────────────────────────────
    var d = [];
    d.push('M ' + waypoints[0].pt[0].toFixed(2) + ' ' + waypoints[0].pt[1].toFixed(2));

    for (var j = 1; j < waypoints.length; j++) {
        var pwp = waypoints[j - 1];
        var cwp = waypoints[j];
        var px = pwp.pt[0], py = pwp.pt[1];
        var qx = cwp.pt[0], qy = cwp.pt[1];

        if (pwp.dir === cwp.dir) {
            // Straight segment: simple line
            d.push('L ' + qx.toFixed(2) + ' ' + qy.toFixed(2));
        } else {
            // 90° turn: quadratic bézier.
            // Control point = intersection of the two tangent lines:
            //   Incoming horizontal (E/W): fixed y = py, any x  →  x = qx
            //   Incoming vertical   (N/S): fixed x = px, any y  →  y = qy
            var cpx, cpy;
            if (pwp.dir === 'E' || pwp.dir === 'W') {
                cpx = qx; cpy = py;   // H→V turn
            } else {
                cpx = px; cpy = qy;   // V→H turn
            }
            d.push('Q ' + cpx.toFixed(2) + ' ' + cpy.toFixed(2) +
                   ' '  + qx.toFixed(2)  + ' ' + qy.toFixed(2));
        }
    }

    return d.join(' ');
}

// ---------------------------------------------------------------------------
// draw_wires_overlay  –  create (or replace) the SVG wire layer
// ---------------------------------------------------------------------------
function draw_wires_overlay(resultsMap) {
    var old = document.getElementById('wire_overlay_svg');
    if (old) old.remove();

    var cs = _get_cell_size();
    if (!cs || cs < 1) { console.warn('overlay.js: could not measure cell size'); return; }

    // Grid dimensions (in cells) – read from the global JS grid array
    var cols  = (typeof grid !== 'undefined' && grid.length)         ? grid.length    : 0;
    var rows  = (typeof grid !== 'undefined' && grid[0] && grid[0].length) ? grid[0].length : 0;

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg   = document.createElementNS(svgNS, 'svg');
    svg.id    = 'wire_overlay_svg';
    svg.setAttribute('width',  (cols * cs).toFixed(0));
    svg.setAttribute('height', (rows * cs).toFixed(0));
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;overflow:visible';

    // Lane geometry: 5 % padding each side → wires occupy 90 % of the cell.
    // Each lane gets an equal slot; wire fills 82 % of the slot (small gap between wires).
    var LANE_PADDING = 0.05;
    var usable    = cs * (1 - 2 * LANE_PADDING);    // 90 % of cell
    var step      = usable / TOTAL_LANES;            // slot per lane
    var wireWidth = step * 0.82;                     // slightly thicker, tiny inter-wire gap

    for (var a = 0; a < TOTAL_LANES; a++) {
        var name = ALGO_ORDER[a];
        var r    = resultsMap[name];
        if (!r || !r.path || r.path.length < 2) continue;

        // Lane centre offset from the cell midline.
        // Lane 0 starts at LANE_PADDING*cs; each subsequent lane steps by `step`.
        var laneOffset = (LANE_PADDING * cs) + (a + 0.5) * step - (cs / 2);

        var dStr = _wire_path_d(r.path, cs, laneOffset);
        if (!dStr) continue;

        var pathEl = document.createElementNS(svgNS, 'path');
        pathEl.setAttribute('d',               dStr);
        pathEl.setAttribute('stroke',          ALGO_COLORS[name] || '#888');
        pathEl.setAttribute('stroke-width',    wireWidth.toFixed(2));
        pathEl.setAttribute('fill',            'none');
        pathEl.setAttribute('stroke-linecap',  'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.setAttribute('opacity',         '0.93');
        svg.appendChild(pathEl);
    }

    var gridEl = document.getElementById('grid');
    if (gridEl) gridEl.appendChild(svg);
}

// ---------------------------------------------------------------------------
// clear_overlay  –  remove the SVG and any residual cell overrides
// ---------------------------------------------------------------------------
function clear_overlay() {
    var svgEl = document.getElementById('wire_overlay_svg');
    if (svgEl) svgEl.remove();

    // Strip any background overrides left from previous runs
    var allCells = document.querySelectorAll('.cell');
    for (var i = 0; i < allCells.length; i++) {
        var cell = allCells[i];
        cell.style.background    = '';
        cell.style.backgroundImage = '';
        cell.classList.remove('cell_path', 'cell_algo', 'visited_cell');
    }

    var legend = document.getElementById('overlay_legend');
    if (legend) legend.style.display = 'none';
}

// ---------------------------------------------------------------------------
// show_overlay  –  public entry point
// ---------------------------------------------------------------------------
function show_overlay(resultsMap) {
    if (!resultsMap) resultsMap = {};

    // 1. Strip exploration dots / single-algo path highlights from all cells
    var allCells = document.querySelectorAll('.cell');
    for (var i = 0; i < allCells.length; i++) {
        var cell = allCells[i];
        cell.classList.remove('cell_algo', 'cell_path', 'visited_cell');
        cell.style.background      = '';
        cell.style.backgroundImage = '';
    }

    // 2. Yellow background highlight for the A*h1 (optimal) path.
    //    Painted first so the SVG wire layer renders on top, preserving the
    //    directional wires while giving a clear "optimal path" fill underneath.
    var astarH1 = resultsMap['AStar_h1'];
    if (astarH1 && astarH1.path) {
        for (var p = 0; p < astarH1.path.length; p++) {
            var node = astarH1.path[p];
            // Skip start/target so their icons are not overridden
            if (typeof start_pos  !== 'undefined' &&
                node[0] === start_pos[0]  && node[1] === start_pos[1])  continue;
            if (typeof target_pos !== 'undefined' &&
                node[0] === target_pos[0] && node[1] === target_pos[1]) continue;
            var hlCell = place_to_cell(node[0], node[1]);
            if (hlCell) hlCell.classList.add('cell_path');
        }
    }

    // 3. Draw directional wires on top
    draw_wires_overlay(resultsMap);

    // 4. Legend
    _build_legend(resultsMap);
}

// ---------------------------------------------------------------------------
// _build_legend
// ---------------------------------------------------------------------------
function _build_legend(resultsMap) {
    var legend = document.getElementById('overlay_legend');
    if (!legend) return;

    var rows = legend.querySelectorAll('.legend_row');
    for (var i = 0; i < rows.length; i++) rows[i].remove();

    for (var a = 0; a < ALGO_ORDER.length; a++) {
        var name    = ALGO_ORDER[a];
        var r       = resultsMap[name];
        var hasPath = r && r.path && r.path.length > 0;
        var color   = ALGO_COLORS[name] || '#888';

        var row = document.createElement('div');
        row.className = 'legend_row';

        var swatch = document.createElement('div');
        swatch.className = 'legend_swatch';
        swatch.style.background = hasPath ? color : 'rgba(80,80,80,0.35)';

        // For A*h1 show a split swatch: yellow cell fill on the left, wire colour on the right
        if (name === 'AStar_h1' && hasPath) {
            swatch.style.background = 'linear-gradient(90deg, rgb(251,244,79) 50%, ' + color + ' 50%)';
        }

        var label = document.createElement('span');
        label.textContent = (ALGO_LABELS[name] || name)
            + (name === 'AStar_h1' && hasPath ? ' ★ optimal' : '')
            + (hasPath ? '' : ' (no path)');
        if (!hasPath) label.style.opacity = '0.4';

        row.appendChild(swatch);
        row.appendChild(label);
        legend.appendChild(row);
    }

    legend.style.display = 'block';
}

// Expose globally
window.show_overlay   = show_overlay;
window.clear_overlay  = clear_overlay;
window.ALGO_COLORS    = ALGO_COLORS;
window.ALGO_ORDER     = ALGO_ORDER;
