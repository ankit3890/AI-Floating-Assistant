const { ipcRenderer } = require('electron');

// --- Debug Logger (Disabled) ---
// Standard console logging will be used.


// --- State ---
const state = {
    isDrawing: false,
    tool: 'pen', // pen, highlighter, eraser, select
    
    // Per-Tool Settings
    tools: {
        pen: { color: '#ff0000', size: 5 },
        highlighter: { color: '#ffff00', size: 30 },
        eraser: { size: 20 },
        select: {} // No settings
    },

    paths: [], // Array of stroke objects
    undoStack: [], // Array of history snapshots
    redoStack: [],
    
    // Selection
    selection: {
        active: false,
        elementIds: [], // Indices of selected paths
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        originalPaths: [] // Snapshot for drag processing
    },

    // Pointer
    lastPos: { x: 0, y: 0 }
};

// --- Elements ---
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('drawing-toolbar');

// --- Initialization ---

function init() {
    console.log('Initializing Drawing Overlay...');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupToolbar();
    setupShortcuts();
    
    // Initialize UI inputs with loaded state
    syncUIWithState();

    // Canvas Listeners
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp); // Window to catch drag-outs
    
    // Start loop
    requestAnimationFrame(render);
    console.log('Initialization Complete');
}

function syncUIWithState() {
    // Set initial values for inputs based on state defaults
    document.querySelectorAll('.tool-color-picker').forEach(input => {
        const tool = input.dataset.target;
        if (state.tools[tool] && state.tools[tool].color) input.value = state.tools[tool].color;
    });
    
    document.querySelectorAll('.tool-size-slider').forEach(input => {
        const tool = input.dataset.target;
        if (state.tools[tool] && state.tools[tool].size) input.value = state.tools[tool].size;
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}

// --- Drawing Engine ---

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw all paths
    state.paths.forEach((path, index) => {
        const isSelected = state.selection.elementIds.includes(index);
        drawPath(path, isSelected);
    });
    
    // 2. Draw current stroke (if drawing && not selecting)
    if (state.isDrawing && state.currentPath && state.tool !== 'select') {
        drawPath(state.currentPath, false);
    }

    // 3. Draw Selection Box (Lasso trace)
    if (state.isDrawing && state.tool === 'select' && state.currentPath) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        state.currentPath.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
    }
}

function drawPath(path, isSelected) {
    if (path.points.length === 0) return;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = path.size;
    
    if (path.isHighlighter) {
        ctx.globalAlpha = 0.4;
    }

    ctx.strokeStyle = isSelected ? '#4facfe' : path.color;
    
    if (isSelected) {
        ctx.setLineDash([5, 5]); 
    }

    ctx.beginPath();
    path.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    
    ctx.restore();
}

// --- Interaction Logic ---

function handlePointerDown(e) {
    if (e.target.closest('.toolbar')) return; // Ignore toolbar clicks
    if (e.target.closest('.tool-popover')) return; // Ignore popover clicks

    console.log(`Pointer Down at ${e.clientX}, ${e.clientY} (Tool: ${state.tool})`);
    
    state.isDrawing = true;
    state.lastPos = { x: e.clientX, y: e.clientY };

    if (state.tool === 'select') {
        // Check if clicking existing selection to DRAG
        if (state.selection.active && isPointInSelection(e.clientX, e.clientY)) {
            startDragSelection(e.clientX, e.clientY);
        } else {
            // New selection lasso
            clearSelection();
            state.currentPath = {
                points: [{ x: e.clientX, y: e.clientY }],
                type: 'lasso'
            };
        }
    } else {
        // Drawing tools: GET SETTINGS FROM CURRENT TOOL STATE
        clearSelection();
        
        const toolSettings = state.tools[state.tool];
        // Fallback if something is wrong with state, though shouldn't happen
        const color = toolSettings ? toolSettings.color : '#ffffff';
        const size = toolSettings ? toolSettings.size : 5;

        state.currentPath = {
            points: [{ x: e.clientX, y: e.clientY }],
            color: state.tool === 'eraser' ? '#ffffff' : color, 
            size: size,
            isHighlighter: state.tool === 'highlighter',
            tool: state.tool
        };
    }
    
    render();
}

function handlePointerMove(e) {
    if (!state.isDrawing) return;

    if (state.selection.isDragging) {
        // Move Selection
        const dx = e.clientX - state.selection.dragStart.x;
        const dy = e.clientY - state.selection.dragStart.y;
        
        state.selection.elementIds.forEach((idx, i) => {
            const originalPath = state.selection.originalPaths[i];
            state.paths[idx].points = originalPath.points.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        });
    } else {
        // Continue Drawing / Lassoing
        state.currentPath.points.push({ x: e.clientX, y: e.clientY });
        
        if (state.tool === 'eraser') {
            applyEraser(e.clientX, e.clientY);
        }
    }
    render();
}

function handlePointerUp(e) {
    if (!state.isDrawing) return;
    console.log(`Pointer Up. Path length: ${state.currentPath ? state.currentPath.points.length : 'null'}`);
    state.isDrawing = false;

    if (state.selection.isDragging) {
        state.selection.isDragging = false;
        pushHistory();
        return;
    }

    if (state.tool === 'select') {
        finishLasso();
    } else if (state.tool !== 'eraser') {
        if (state.currentPath && state.currentPath.points.length > 0) {
            state.paths.push(state.currentPath);
            pushHistory();
            console.log('Path committed');
        } else {
            console.log('Path too short or null, discarded');
        }
    } else {
        pushHistory(); 
    }
    
    state.currentPath = null;
    render();
}

// --- Tool Specifics ---

function applyEraser(x, y) {
    const toolSettings = state.tools['eraser'];
    const eraseRadius = toolSettings ? toolSettings.size : 20; 
    
    const indexesToRemove = [];
    state.paths.forEach((path, index) => {
        for (let p of path.points) {
            const dist = Math.hypot(p.x - x, p.y - y);
            if (dist < eraseRadius) {
                indexesToRemove.push(index);
                break;
            }
        }
    });
    
    if (indexesToRemove.length > 0) {
        indexesToRemove.sort((a, b) => b - a);
        indexesToRemove.forEach(idx => state.paths.splice(idx, 1));
    }
}

function finishLasso() {
    if (!state.currentPath) return;
    
    const lassoPoly = state.currentPath.points;
    const selectedIds = [];
    
    state.paths.forEach((path, index) => {
        let cx = 0, cy = 0;
        path.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= path.points.length;
        cy /= path.points.length;
        
        if (pointInPolygon({x: cx, y: cy}, lassoPoly)) {
            selectedIds.push(index);
        }
    });
    
    state.selection.elementIds = selectedIds;
    state.selection.active = selectedIds.length > 0;
    
    render();
}

function startDragSelection(x, y) {
    state.selection.isDragging = true;
    state.selection.dragStart = { x, y };
    
    state.selection.originalPaths = state.selection.elementIds.map(idx => {
        return JSON.parse(JSON.stringify(state.paths[idx]));
    });
}

function isPointInSelection(x, y) {
    if (!state.selection.active) return false;
    for (let idx of state.selection.elementIds) {
        const path = state.paths[idx];
        for (let p of path.points) {
            if (Math.hypot(p.x - x, p.y - y) < 20) return true; 
        }
    }
    return false;
}

// --- History ---

function pushHistory() {
    if (state.undoStack.length > 20) state.undoStack.shift();
    state.undoStack.push(JSON.stringify(state.paths));
    state.redoStack = []; 
}

// --- Helpers ---
function clearSelection() {
    state.selection.active = false;
    state.selection.elementIds = [];
    render();
}

function pointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- UI Logic ---

function setupToolbar() {
    // Tool buttons (Activate Tool)
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTool(btn.dataset.tool);
            
            // UI Update
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            closeAllPopovers();
        });
    });

    // Settings Buttons (Toggle Popover)
    document.querySelectorAll('.settings-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const tool = btn.dataset.tool;
            const popover = document.getElementById(`popover-${tool}`);
            
            if (!popover) return;

            // Close others
            document.querySelectorAll('.tool-popover').forEach(p => {
                if (p.id !== `popover-${tool}`) p.classList.remove('active');
            });
            
            popover.classList.toggle('active');
        });
    });

    // Close Popovers on Outside Click
    window.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.tool-popover') && !e.target.closest('.settings-btn')) {
            closeAllPopovers();
        }
    });

    // Inputs: Color Pickers
    document.querySelectorAll('.tool-color-picker').forEach(input => {
        input.addEventListener('input', (e) => {
            const tool = e.target.dataset.target;
            if (state.tools[tool]) {
                state.tools[tool].color = e.target.value;
                console.log(`Updated ${tool} color to ${e.target.value}`);
            }
        });
    });

    // Inputs: Size Sliders
    document.querySelectorAll('.tool-size-slider').forEach(input => {
        input.addEventListener('input', (e) => {
            const tool = e.target.dataset.target;
            if (state.tools[tool]) {
                state.tools[tool].size = parseInt(e.target.value);
                console.log(`Updated ${tool} size to ${e.target.value}`);
            }
        });
    });

    // Actions
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-clear').addEventListener('click', clearAll);
    document.getElementById('btn-exit').addEventListener('click', () => {
        ipcRenderer.send('draw-exit');
    });

    // Dragging Toolbar
    const handle = document.querySelector('.drag-handle');
    let isDraggingToolbar = false;
    let dragOffset = { x: 0, y: 0 };

    if (handle) {
        handle.addEventListener('mousedown', (e) => {
            isDraggingToolbar = true;
            const rect = toolbar.getBoundingClientRect();
            dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingToolbar) return;
            toolbar.style.left = (e.clientX - dragOffset.x) + 'px';
            toolbar.style.top = (e.clientY - dragOffset.y) + 'px';
            toolbar.style.transform = 'none'; 
        });

        window.addEventListener('mouseup', () => {
            isDraggingToolbar = false;
        });
    }
}

function closeAllPopovers() {
    document.querySelectorAll('.tool-popover').forEach(p => p.classList.remove('active'));
}

function setTool(toolName) {
    state.tool = toolName;
    canvas.style.cursor = toolName === 'select' ? 'default' : 'crosshair';
    console.log(`Tool changed to: ${toolName}`);
}

function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.selection.active) {
                state.selection.active = false;
                render();
            } else {
                ipcRenderer.send('draw-exit');
            }
        }
        
        // Tools
        if (e.key.toLowerCase() === 'p') {
            const btn = document.querySelector('[data-tool="pen"]');
            if (btn) btn.click();
        }
        if (e.key.toLowerCase() === 'h') {
            const btn = document.querySelector('[data-tool="highlighter"]');
            if (btn) btn.click();
        }
        if (e.key.toLowerCase() === 'e') {
            const btn = document.querySelector('[data-tool="eraser"]');
            if (btn) btn.click();
        }
        if (e.key.toLowerCase() === 'l') {
            const btn = document.querySelector('[data-tool="select"]');
            if (btn) btn.click();
        }
        
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            redo();
        }
        // Clear / Reset (Shift + Delete)
        if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
            clearAll();
        }
        
        // Toggle Debug Console
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            const consoleDiv = document.getElementById('debug-console');
            if (consoleDiv) {
                consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
                console.log('Toggled Debug Console');
            }
        }

        // Delete Selection
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selection.active) {
                pushHistory();
                state.selection.elementIds.sort((a,b) => b-a).forEach(idx => state.paths.splice(idx, 1));
                state.selection.active = false;
                render();
            }
        }
    });
}

function undo() {
    if (state.undoStack.length === 0) {
        console.log('Undo stack empty');
        return;
    }
    
    state.redoStack.push(JSON.stringify(state.paths));
    
    const prev = state.undoStack.pop();
    state.paths = JSON.parse(prev);
    state.selection.active = false;
    render();
    console.log('Undo performed');
}

function redo() {
    if (state.redoStack.length === 0) {
        console.log('Redo stack empty');
        return;
    }
    
    state.undoStack.push(JSON.stringify(state.paths));
    
    const next = state.redoStack.pop();
    state.paths = JSON.parse(next);
    state.selection.active = false;
    render();
    console.log('Redo performed');
}

function clearAll() {
    pushHistory();
    state.paths = [];
    state.selection.active = false;
    render();
    console.log('Canvas cleared');
}

// Initial push & start
pushHistory();
init();
