/**
 * Planning Board - Visual Workspace for Ideas
 * Standalone module - does not interfere with existing AI features
 */

class PlanningBoard {
    constructor(containerId) {
        // FIX: Enforce Singleton Pattern but RE-INITIALIZE to handle DOM changes
        if (window.planningBoard) {
            console.log('🔄 Reloading existing PlanningBoard instance...');
            const instance = window.planningBoard;
            instance.init(); // Force re-bind to potentially new DOM elements
            return instance;
        }
        window.planningBoard = this;

        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Planning Board container not found');
            return;
        }

        // Canvas state
        this.canvas = document.getElementById('drawing-layer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.elementsContainer = document.getElementById('elements-container');
        
        // View state
        this.viewState = {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            minScale: 0.1,
            maxScale: 3
        };

        // Interaction state
        this.isPanning = false;
        this.isDrawing = false;
        this.isDragging = false;
        this.isResizing = false;
        this.panStart = { x: 0, y: 0 };
        this.dragStart = { x: 0, y: 0 };
        this.isRotating = false;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
        this.rotateStart = { x: 0, y: 0, initialAngle: 0 };
        this.draggedElement = null;
        this.resizingElement = null;
        this.resizeHandleType = null;
        this.selectedElements = [];
        
        // Text tool sizing state
        this.isSizingText = false;
        this.textSizingStart = { x: 0, y: 0 };
        
        // Elements storage
        this.elements = [];
        this.drawingPaths = [];
        
        // Drawing state
        this.drawingColor = '#3b82f6';
        this.drawingWidth = 3;
        this.currentPath = [];
        
        // Drawing state
        this.drawingColor = '#3b82f6';
        this.drawingWidth = 3;
        this.currentPath = [];
        
        // Board file management
        this.currentBoardPath = null;
        this.currentBoardName = 'Untitled';
        this.hasUnsavedChanges = false;
        this.renderPending = false;

        // Undo/Redo History
        this.history = [];
        this.historyStep = -1;
        this.maxHistory = 50;

        this.init();
    }

    init() {
        this.setupCanvas();
        // this.createDebugOverlay(); // Debug overlay removed
        this.setupEventListeners();
        this.loadFromStorage();
        if (this.container) {
            this.container.style.pointerEvents = 'auto'; // Hardened hit-capture
        }
        this.render();
    }

    // Debug Overlay for troubleshooting
    createDebugOverlay() {
        if (document.getElementById('board-debug-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'board-debug-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 60px;
            right: 20px;
            padding: 10px;
            background: rgba(0,0,0,0.8);
            color: #0f0;
            font-family: monospace;
            font-size: 10px;
            z-index: 10000;
            pointer-events: none;
            border-radius: 4px;
            border: 1px solid #333;
        `;
        overlay.innerHTML = `
            <div>Tool: <span id="debug-tool">Select</span></div>
            <div>Target: <span id="debug-target">-</span></div>
            <div>Pos: <span id="debug-pos">0,0</span></div>
            <div>DPR: <span id="debug-dpr">${window.devicePixelRatio}</span></div>
            <div>C-Rect: <span id="debug-crect">-</span></div>
            <div>C-Size: <span id="debug-csize">-</span></div>
            <div>L-Attached: <span id="debug-listeners">False</span></div>
        `;
        if (!this.pane) {
            console.warn('Debug Overlay skipped: this.pane not initialized');
            return;
        }
        this.pane.appendChild(overlay);

        // Global Tracer
        window.addEventListener('mousedown', (e) => {
            const target = e.target;
            const debugTarget = document.getElementById('debug-target');
            if (debugTarget) {
                debugTarget.innerText = `${target.tagName}${target.id ? '#' + target.id : ''}${target.className ? '.' + target.className.split(' ')[0] : ''}`;
            }
            console.log('🖱️ Board MouseDown Target:', target);
        }, true);
    }

    setupCanvas() {
        // FIX: Re-query and assign ALL DOM references immediately BEFORE any other logic
        this.canvas = document.getElementById('drawing-layer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.elementsContainer = document.getElementById('elements-container');
        this.container = document.getElementById('planning-board-canvas'); // Transformed layer
        this.viewport = document.querySelector('.planning-board-viewport'); // Fixed viewport
        this.pane = document.getElementById('pane-planning-board');

        if (!this.canvas || !this.viewport) {
            console.error('Missing canvas or viewport (.planning-board-viewport)');
            return;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // High DPI Canvas Setup
        const setCanvasSize = (width, height) => {
            const dpr = window.devicePixelRatio || 1;
            
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
            
            this.canvas.width = Math.ceil(width * dpr);
            this.canvas.height = Math.ceil(height * dpr);
            
            this.dpr = dpr;
            console.log(`📏 Viewport Resize: ${width}x${height}`);

            this.render();
            this.renderElements();
        };

        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === this.viewport) {
                    const { width, height } = entry.contentRect;
                    if (Math.abs(parseFloat(this.canvas.style.width) - width) > 0.5 || 
                        Math.abs(parseFloat(this.canvas.style.height) - height) > 0.5) {
                        setCanvasSize(width, height);
                    }
                }
            }
        });
        
        this.resizeObserver.observe(this.viewport);
        
        const layoutWidth = this.viewport.offsetWidth;
        const layoutHeight = this.viewport.offsetHeight;
        if (layoutWidth > 0) {
            setCanvasSize(layoutWidth, layoutHeight);
        }
    }

    // Canvas Events
    setupEventListeners() {
        this.bindInteractionEvents();
    }

    bindInteractionEvents() {
        try {
            // RE-QUERY DOM to ensure we have the latest elements
            this.canvas = document.getElementById('drawing-layer');
            this.elementsContainer = document.getElementById('elements-container');
            this.viewport = document.querySelector('.planning-board-viewport');

            // 1. CANVAS LISTENERS (Drawing, Panning)
            if (this.canvas && this.canvas.dataset.listenersAttached !== 'true') {
                console.log('🔌 Attaching CANVAS listeners...');
                this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
                this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
                
                this.canvas.dataset.listenersAttached = 'true';
            }

            // 2. CONTAINER LISTENERS (Element Interactions)
            // CRITICAL FIX: Check this INDEPENDENTLY from canvas
            if (this.elementsContainer && this.elementsContainer.dataset.listenersAttached !== 'true') {
                console.log('🔌 Attaching ELEMENTS CONTAINER listeners...');
                this.elementsContainer.addEventListener('mousedown', (e) => this.handleElementMouseDown(e));
                this.elementsContainer.addEventListener('mousemove', (e) => this.handleElementMouseMove(e));
                this.elementsContainer.addEventListener('mouseup', (e) => this.handleElementMouseUp(e));
                
                this.elementsContainer.dataset.listenersAttached = 'true';
            }

            // 3. GLOBAL/TOOL LISTENERS
            // (These operate on static UI elements or document, safe to run once or re-run benignly)
            this.setupStaticUIListeners();

        } catch (error) {
            console.error('🔥 CRITICAL ERROR in bindInteractionEvents:', error);
        }
    }

    setupStaticUIListeners() {
        // Guard to prevent double-binding global document listeners
        if (window.boardGlobalsAttached) return;

        console.log('🔌 Attaching GLOBAL UI listeners...');
        
        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(btn.dataset.tool);
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Zoom controls
        const zoomIn = document.getElementById('board-zoom-in');
        const zoomOut = document.getElementById('board-zoom-out');
        const resetView = document.getElementById('board-reset-view');
        
        if (zoomIn) zoomIn.addEventListener('click', () => this.zoom(1.2));
        if (zoomOut) zoomOut.addEventListener('click', () => this.zoom(0.8));
        if (resetView) resetView.addEventListener('click', () => this.resetView());

        // Delete button
        const deleteBtn = document.getElementById('board-delete-btn');
        if (deleteBtn) {
           // Remove old listener (clone hack) - ensure fresh start
           const newBtn = deleteBtn.cloneNode(true);
           deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);
           newBtn.addEventListener('click', () => this.deleteSelected());
        }

        // Color picker & Stroke Size
        const colorPicker = document.getElementById('board-color-picker');
        if (colorPicker) colorPicker.addEventListener('change', (e) => this.drawingColor = e.target.value);

        const strokeSize = document.getElementById('board-stroke-size');
        if (strokeSize) strokeSize.addEventListener('change', (e) => this.drawingWidth = parseInt(e.target.value));

        // Help Modal
        const helpBtn = document.getElementById('board-help-btn');
        const helpModal = document.getElementById('board-help-modal');
        const helpClose = document.getElementById('board-help-close');
        
        if (helpBtn && helpModal) helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
        if (helpClose && helpModal) helpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
        if (helpBtn && helpModal) helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
        if (helpClose && helpModal) helpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
        if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });

        // Screen Drawing Button
        const screenDrawBtn = document.getElementById('board-screen-draw');
        if (screenDrawBtn) {
            screenDrawBtn.addEventListener('click', () => {
                if (window.electronAPI && window.electronAPI.startScreenDrawing) {
                    window.electronAPI.startScreenDrawing();
                } else {
                    console.error('Screen Drawing API not available');
                }
            });
        }

        // Board Actions
        const newBtn = document.getElementById('board-new');
        const openBtn = document.getElementById('board-open');
        const saveBtn = document.getElementById('board-save');
        const saveAsBtn = document.getElementById('board-save-as');

        if (newBtn) newBtn.onclick = () => this.newBoard();
        if (openBtn) openBtn.onclick = () => this.openBoard();
        if (saveBtn) saveBtn.onclick = () => this.saveBoard();
        if (saveAsBtn) saveAsBtn.onclick = () => this.saveAsBoard();
        
        // Document Keys
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('paste', (e) => this.handlePaste(e));
        
        // Viewport Double Click (For Edit)
        const vp = document.querySelector('.planning-board-viewport');
        if (vp) {
            vp.addEventListener('dblclick', (e) => {
                 const target = e.target.closest('.board-element');
                 if (target) {
                      const id = parseFloat(target.dataset.id);
                      const element = this.elements.find(el => el.id === id);
                      if (element && element.type === 'text') {
                          this.enterEditMode(element);
                      }
                 }
            });
            // Container Pan
            vp.addEventListener('mousedown', (e) => this.handleContainerMouseDown(e));
            vp.addEventListener('mousemove', (e) => this.handleContainerMouseMove(e));
            vp.addEventListener('mouseup', (e) => this.handleContainerMouseUp(e));
        }

        window.boardGlobalsAttached = true;


    }

    setTool(tool) {
        this.currentTool = tool;
        
        // FIX: Aggressively finding live DOM elements to ensure attributes persist after re-renders
        const liveViewport = document.querySelector('.planning-board-viewport');
        const liveCanvas = document.getElementById('drawing-layer');
        
        if (liveViewport) {
            this.viewport = liveViewport; // Update cached ref
            this.viewport.dataset.tool = tool;
        } else {
             console.warn('SetTool: Viewport not found!');
        }
        
        // FIX: Dynamically enable/disable layers based on tool
        if (liveCanvas) {
            this.canvas = liveCanvas; // Update cached ref
            if (tool === 'draw' || tool === 'eraser') {
                // Drawing: Canvas MUST be on top (Z-30) to capture all input
                this.canvas.style.pointerEvents = 'all';
                this.canvas.style.zIndex = '30'; 
                this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'cell';
            } else if (tool === 'text') {
                // Text: Canvas interactive but BELOW elements (Z-20)
                this.canvas.style.pointerEvents = 'all'; 
                this.canvas.style.zIndex = '10'; 
                this.canvas.style.cursor = 'crosshair';
            } else if (tool === 'image') {
                this.canvas.style.pointerEvents = 'all';
                this.canvas.style.zIndex = '10';
                this.canvas.style.cursor = 'default';
            } else {
                // Select tool: Elements interactive, Canvas hidden/inert
                this.canvas.style.pointerEvents = 'none';
                this.canvas.style.zIndex = '10'; 
                this.canvas.style.cursor = 'default';
            }
        }
        
        // FIX: Show/Hide Instruction Overlay
        const overlay = document.getElementById('board-instruction-overlay');
        const text = document.getElementById('instruction-text');
        
        if (overlay && text) {
            if (tool === 'text') {
                text.innerText = 'Click and drag to create text box';
                overlay.classList.remove('hidden');
            } else if (tool === 'image') {
                text.innerText = 'Drag and drop or copy paste the image';
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
        
        this.updateToolButtons();
    }

    // FIX: Transform screen coordinates to canvas coordinates
    // Now using manual world-coordinate math since canvas is fixed to viewport
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Logical position relative to canvas top-left
        const lx = screenX - rect.left;
        const ly = screenY - rect.top;

        // Map to world coordinates: (logical - offset) / scale
        const x = (lx - this.viewState.offsetX) / this.viewState.scale;
        const y = (ly - this.viewState.offsetY) / this.viewState.scale;
        
        // Debug info
        const debugPos = document.getElementById('debug-pos');
        if (debugPos) debugPos.innerText = `${Math.round(x)},${Math.round(y)}`;
        
        return { x, y };
    }

    handleMouseDown(e) {
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);

        // FIX: Select tool should pan by default
        if (this.currentTool === 'select' || e.button === 1) {
            // Pan mode
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.viewState.offsetX, y: e.clientY - this.viewState.offsetY };
            this.canvas.style.cursor = 'grabbing';
        } else if (this.currentTool === 'draw' || this.currentTool === 'eraser') {
            // Drawing mode - FIX: Use canvas coordinates
            this.isDrawing = true;
            this.currentPath = [canvasCoords];
        } else if (this.currentTool === 'text') {
            // FIX: Start sizing text box
            this.isSizingText = true;
            this.textSizingStart = canvasCoords;
            this.isDrawing = true; // Trigger preview loop
            this.currentPath = [canvasCoords];
        } else if (this.currentTool === 'image') {
            // Trigger file input or show message
            // alert('Paste an image (Ctrl+V) or drag & drop an image file');
        }
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            this.viewState.offsetX = e.clientX - this.panStart.x;
            this.viewState.offsetY = e.clientY - this.panStart.y;
            this.updateTransform();
        } else if (this.isDrawing) {
            // FIX: Use canvas coordinates for drawing
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            this.currentPath.push(canvasCoords);
            this.drawCurrentPath();
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'grab' : 
                                       this.currentTool === 'draw' ? 'crosshair' : 'default';
        } else if (this.isSizingText) {
            this.isSizingText = false;
            this.isDrawing = false;
            
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            const width = Math.abs(canvasCoords.x - this.textSizingStart.x);
            const height = Math.abs(canvasCoords.y - this.textSizingStart.y);
            const x = Math.min(canvasCoords.x, this.textSizingStart.x);
            const y = Math.min(canvasCoords.y, this.textSizingStart.y);
            
            // Create with sizing ONLY if drag occurred (prevent accidental clicks)
            if (width > 10 && height > 10) {
                this.addTextBlock(x, y, width, height);
            }
            
            this.currentPath = [];
            this.clearCanvas();
        } else if (this.isDrawing) {
            this.isDrawing = false;
            
            if (this.currentTool === 'eraser') {
                // Eraser: delete drawing elements that intersect with eraser path
                if (this.currentPath.length > 1) {
                    this.eraseDrawings(this.currentPath);
                }
            } else if (this.currentPath.length > 1) {
                // Draw: create new drawing element
                const drawingElement = {
                    id: Date.now(),
                    type: 'drawing',
                    points: [...this.currentPath],
                    color: this.drawingColor,
                    strokeWidth: this.drawingWidth, // FIX: Renamed from width to avoid collision
                    tool: this.currentTool,
                    // Calculate bounding box for positioning
                    x: Math.min(...this.currentPath.map(p => p.x)) - 10,
                    y: Math.min(...this.currentPath.map(p => p.y)) - 10,
                    width: Math.max(...this.currentPath.map(p => p.x)) - Math.min(...this.currentPath.map(p => p.x)) + 20,
                    height: Math.max(...this.currentPath.map(p => p.y)) - Math.min(...this.currentPath.map(p => p.y)) + 20
                };
                
                this.elements.push(drawingElement);
                this.renderElements();
                this.pushState(); // Save state
                this.saveToStorage();
            }
            this.currentPath = [];
            this.clearCanvas(); // Clear temporary drawing
        }
    }

    eraseDrawings(eraserPath) {
        // Find and remove drawing elements that intersect with eraser path
        const eraserRadius = 10 / this.viewState.scale; // Adjust radius for zoom!
        let deletedCount = 0;
        
        console.log('🧹 Eraser running. Path points:', eraserPath.length, 'Radius:', eraserRadius);

        this.elements = this.elements.filter(element => {
            if (element.type !== 'drawing') return true; // Keep non-drawing elements
            
            // Check if any point in the drawing intersects with eraser path
            for (let drawPoint of element.points) {
                for (let erasePoint of eraserPath) {
                    const dx = drawPoint.x - erasePoint.x;
                    const dy = drawPoint.y - erasePoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < eraserRadius) {
                        deletedCount++;
                        return false; // Remove this drawing
                    }
                }
            }
            return true; // Keep this drawing
        });
        
        if (deletedCount > 0) {
            console.log('🗑️ Erased', deletedCount, 'elements');
            this.renderElements();
            this.pushState(); 
            this.saveToStorage();
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(delta, e.clientX, e.clientY);
    }

    // Element dragging - text/images movable in any mode
    handleElementMouseDown(e) {
        const target = e.target.closest('.board-element');
        if (!target) return;

        // FIX: Use parseFloat to handle float IDs (Critical for duplicates: e.g. 123.456)
        const elementId = parseFloat(target.dataset.id); 
        const element = this.elements.find(el => el.id === elementId);
        if (!element) return;

        // Custom Logic for Text Tool (Threshold-Based):
        // 1. MouseDown -> Pending State (Waiting to see if it's a Click or Drag)
        // 2. MouseDown (Detail=2) -> Force Drag (Double-click-drag)
        // 3. MouseUp (If Pending) -> Activate Edit Mode (Click)
        // 4. MouseMove (>5px) -> Activate Drag Mode
        
        // Select this element
        this.selectElement(element);

        // Save state BEFORE starting a drag/modify operation?
        // No, save AFTER. But we need to know if it changed.
        // Actually best to snapshot "Before" state in case we want to support granular undo,
        // But for this simple stack, we can just pushState() AFTER completion.
        
        // Allow dragging immediately
        e.stopPropagation();
        
        // Simpler Logic: Always wait for drag threshold.
        // Double-clicks will be handled by the separate 'dblclick' listener for editing.
        this.isDragPending = true;
        this.isDragging = false;

        this.draggedElement = element;
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            elementX: element.x,
            elementY: element.y,
            // FIX: Cache points for drawings so they can be moved
            originalPoints: element.type === 'drawing' ? element.points.map(p => ({...p})) : null
        };
        
        // Don't change cursor yet (wait for actual drag)
        
        // GLOBAL LISTENERS (Fix Sticky Drag)
        this.dragMoveHandler = (ev) => this.handleElementMouseMove(ev);
        this.dragUpHandler = (ev) => this.handleElementMouseUp(ev);
        document.addEventListener('mousemove', this.dragMoveHandler);
        document.addEventListener('mouseup', this.dragUpHandler);
    }

    selectElement(element) {
        // Clear previous selection
        this.selectedElements = [element];
        
        // Update UI to show selection
        document.querySelectorAll('.board-element').forEach(el => {
            el.classList.remove('selected');
        });
        
        const selectedEl = document.querySelector(`.board-element[data-id="${element.id}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
        
        // Show delete button in toolbar
        this.updateToolbar();
    }

    updateToolbar() {
        const deleteBtn = document.getElementById('board-delete-btn');
        if (deleteBtn) {
            if (this.selectedElements.length > 0) {
                deleteBtn.style.display = 'flex';
            } else {
                deleteBtn.style.display = 'none';
            }
        }
    }

    handleElementMouseMove(e) {
        if (!this.isDragPending && !this.isDragging) return;
        if (!this.draggedElement) return;

        // Calculate delta in World Space
        const dxRaw = e.clientX - this.dragStart.x;
        const dyRaw = e.clientY - this.dragStart.y;

        // FIX: Drag Threshold Logic
        if (this.isDragPending) {
            const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
            if (dist < 5) return; // Ignore micro-movements (allow clicks)
            
            this.isDragging = true;
            this.isDragPending = false;
            
            // Visual feedback
             const el = document.querySelector(`.board-element[data-id="${this.draggedElement.id}"]`);
             if (el) el.style.cursor = 'grabbing';
        }

        const dx = dxRaw / this.viewState.scale;
        const dy = dyRaw / this.viewState.scale;

        // Update Element Position
        const newX = this.dragStart.elementX + dx;
        const newY = this.dragStart.elementY + dy;

        this.draggedElement.x = newX;
        this.draggedElement.y = newY;

        // Update Drawing Points if needed
        if (this.draggedElement.type === 'drawing' && this.dragStart.originalPoints) {
            this.draggedElement.points = this.dragStart.originalPoints.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        }

        // Throttle Rendering for smoothness
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.renderElements(); // Re-render everything ensures SVG logic is correct
                this.renderPending = false;
            });
        }
    }

    handleElementMouseUp(e) {
         this.isDragPending = false; // Cancel pending drag (was a click)
         
         const wasDragging = this.isDragging;
         
         if (this.isDragging) {
             this.isDragging = false;
             this.draggedElement = null;
             this.dragStart.originalPoints = null; // Clear cache
             this.pushState();
             this.saveToStorage();
             
             document.querySelectorAll('.board-element').forEach(el => {
                 el.style.cursor = 'grab';
             });
         }
         
         // Cleanup global listeners (Fixes Sticky Drag)
         if (this.dragMoveHandler) {
             document.removeEventListener('mousemove', this.dragMoveHandler);
             document.removeEventListener('mouseup', this.dragUpHandler);
             this.dragMoveHandler = null;
             this.dragUpHandler = null;
         }
         
         // Note: Editing now handled by Double Click (see setupEventListeners)
    }

    enterEditMode(element) {
        if (!element || element.type !== 'text') return;
        
        const elDiv = document.querySelector(`.board-element[data-id="${element.id}"]`);
        if (!elDiv) return;
        
        const contentDiv = elDiv.querySelector('.text-content');
        if (!contentDiv) return;

        // Apply visual editing state
        elDiv.classList.add('editing');
        contentDiv.classList.add('editing');

        contentDiv.contentEditable = 'true';
        contentDiv.focus();
        
        // Select all text for easy replacement
        const range = document.createRange();
        range.selectNodeContents(contentDiv);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Handle Blur (Save and Exit)
        const blurHandler = () => {
             // Delay slightly to allow click logic to clear if needed
            contentDiv.contentEditable = 'false';
            elDiv.classList.remove('editing');
            contentDiv.classList.remove('editing');
            
            element.content = contentDiv.innerText;
            this.pushState();
            this.saveToStorage();
            
            contentDiv.removeEventListener('blur', blurHandler);
            
            // Restore selection state (optional, but good UX to keep selected)
             // this.selectElement(element); 
        };
        contentDiv.addEventListener('blur', blurHandler);
    }


    // Container-level pan handlers (for select tool on empty space)
    handleContainerMouseDown(e) {
        // Only pan if select tool and not clicking on an element
        if (this.currentTool !== 'select' && e.button !== 1) return;
        
        // If clicking on element, don't pan here
        if (e.target.closest('.board-element')) return;

        // Clear selection when clicking empty space
        this.selectedElements = [];
        document.querySelectorAll('.board-element').forEach(el => {
            el.classList.remove('selected');
        });
        this.updateToolbar();

        this.isPanning = true;
        this.panStart = { x: e.clientX - this.viewState.offsetX, y: e.clientY - this.viewState.offsetY };
        if (this.viewport) this.viewport.style.cursor = 'grabbing';
    }

    handleContainerMouseMove(e) {
        if (this.isPanning && this.panStart) {
            const newX = e.clientX - this.panStart.x;
            const newY = e.clientY - this.panStart.y;
            
            // MATH GUARDRAIL
            if (!isNaN(newX) && !isNaN(newY)) {
                this.viewState.offsetX = newX;
                this.viewState.offsetY = newY;
                this.updateTransform();
            }
        }
    }

    handleContainerMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = 'grab';
        }
    }

    handleKeyDown(e) {
        // Only handle if Planning Board is active
        const planningPane = document.getElementById('pane-planning-board');
        if (!planningPane || planningPane.classList.contains('hidden')) return;

        // Board file shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                this.saveBoard();
                return;
            } else if (e.key === 'o' || e.key === 'O') {
                e.preventDefault();
                this.openBoard();
                return;
            } else if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                this.newBoard();
                return;
            }
        }

        // Tool shortcuts (only if not editing text)
        const isEditingText = document.activeElement.contentEditable === 'true';
        
        if (!isEditingText) {
            if (e.key === 'v' || e.key === 'V') {
                if (!e.ctrlKey && !e.metaKey) { // Don't interfere with Ctrl+V paste
                    e.preventDefault();
                    this.setTool('select');
                    this.updateToolButtons();
                }
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                this.setTool('text');
                this.updateToolButtons();
            } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault();
                this.setTool('image');
                this.updateToolButtons();
            } else if (e.key === 'd' || e.key === 'D') {
                if (!e.ctrlKey) {
                    e.preventDefault();
                    this.setTool('draw');
                    this.updateToolButtons();
                }
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.setTool('eraser');
                this.updateToolButtons();
            }
        }

        // Delete shortcuts
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!isEditingText) {
                e.preventDefault();
                this.deleteSelected();
            }
        } else if (e.key === 'd' && e.ctrlKey) {
            e.preventDefault();
            // Debounce Duplicate
            const now = Date.now();
            if (this.lastDuplicateTime && (now - this.lastDuplicateTime < 200)) return;
            this.lastDuplicateTime = now;
            
            this.duplicateSelected();
        } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
             e.preventDefault();
             if (e.shiftKey) {
                 this.redo();
             } else {
                 this.undo();
             }
        } else if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
             e.preventDefault();
             this.redo();
        }
    }

    updateToolButtons() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            if (btn.dataset.tool === this.currentTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    handlePaste(e) {
        // Only handle if Planning Board is active
        const planningPane = document.getElementById('pane-planning-board');
        if (!planningPane || planningPane.classList.contains('hidden')) return;

        // FIX: Debounce paste to prevent duplicates if listener attached multiple times
        const now = Date.now();
        if (this.lastPasteTime && (now - this.lastPasteTime < 100)) return;
        this.lastPasteTime = now;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    // Add image at center of viewport
                    const centerX = (this.canvas.width / 2 - this.viewState.offsetX) / this.viewState.scale;
                    const centerY = (this.canvas.height / 2 - this.viewState.offsetY) / this.viewState.scale;
                    this.addImageBlock(event.target.result, centerX - 100, centerY - 100);
                };
                reader.readAsDataURL(blob);
            }
        }
    }

    zoom(factor, centerX, centerY) {
        console.log('🔍 Zoom called with factor:', factor, 'Current:', this.viewState.scale);
        
        const newScale = Math.max(this.viewState.minScale || 0.1, 
                                  Math.min(this.viewState.maxScale || 3, 
                                          this.viewState.scale * factor));
        
        if (newScale === this.viewState.scale) return;

        if (centerX !== undefined && centerY !== undefined) {
            // Zoom towards mouse position
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;
            
            this.viewState.offsetX = mouseX - (mouseX - this.viewState.offsetX) * (newScale / this.viewState.scale);
            this.viewState.offsetY = mouseY - (mouseY - this.viewState.offsetY) * (newScale / this.viewState.scale);
        }
        
        this.viewState.scale = newScale;
        this.updateTransform();
        this.saveToStorage();
    }

    resetView() {
        console.log('🔄 Reset View called');
        this.viewState.offsetX = 0;
        this.viewState.offsetY = 0;
        this.viewState.scale = 1;
        this.updateTransform();
        this.saveToStorage();
    }

    updateTransform() {
        const boardCanvas = document.getElementById('planning-board-canvas');
        if (!boardCanvas) return;

        // MATH GUARDRAILS - Ensure we never set NaN/undefined transforms
        const scale = isNaN(this.viewState.scale) ? 1 : Math.max(0.1, this.viewState.scale);
        const offsetX = isNaN(this.viewState.offsetX) ? 0 : this.viewState.offsetX;
        const offsetY = isNaN(this.viewState.offsetY) ? 0 : this.viewState.offsetY;

        this.viewState.scale = scale;
        this.viewState.offsetX = offsetX;
        this.viewState.offsetY = offsetY;

        boardCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        
        if (this.pane) {
            const gridSize = 20 * scale;
            this.pane.style.backgroundSize = `${gridSize}px ${gridSize}px`;
            // Offset the grid position by the header height (48px) so it lines up with canvas 0,0
            this.pane.style.backgroundPosition = `${offsetX}px ${offsetY + 48}px`;
        }

        // REMOVED this.render() - Transformation should not trigger a full DOM rebuild
    }

    drawCurrentPath() {
        if (!this.ctx || this.currentPath.length < 2) return;
        
        this.clearCanvas(); // Clear previous preview
        
        const dpr = window.devicePixelRatio || 1;
        const scale = this.viewState.scale;
        const offsetX = this.viewState.offsetX;
        const offsetY = this.viewState.offsetY;

        this.ctx.save();
        
        // Apply world transform manually
        this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

        if (this.isSizingText) {
            // Dash rectangle for text preview
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 2 / scale;
            
            const last = this.currentPath[this.currentPath.length - 1];
            const x = Math.min(this.textSizingStart.x, last.x);
            const y = Math.min(this.textSizingStart.y, last.y);
            const w = Math.abs(this.textSizingStart.x - last.x);
            const h = Math.abs(this.textSizingStart.y - last.y);
            
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.setLineDash([]); // Reset
        } else {
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
            for (let i = 1; i < this.currentPath.length; i++) {
                this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
            }
            
            if (this.currentTool === 'eraser') {
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                this.ctx.lineWidth = 20 / scale; // Keep consistent visually
            } else {
                this.ctx.strokeStyle = this.drawingColor;
                this.ctx.lineWidth = this.drawingWidth / scale; // Keep consistent width
            }
            
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    clearCanvas() {
        if (!this.ctx) return;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for physical clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        if (!this.ctx) return;
        this.clearCanvas();
        
        const dpr = window.devicePixelRatio || 1;
        const scale = this.viewState.scale;
        const offsetX = this.viewState.offsetX;
        const offsetY = this.viewState.offsetY;

        // Apply world transform
        this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

        this.drawCurrentPath();
        
        // Finalize
        this.renderElements();
    }

    addTextBlock(x, y, width = 200, height = 100) {
        const textBlock = {
            id: Date.now(),
            type: 'text',
            x: x,
            y: y,
            width: width,
            height: height,
            content: '', // Empty to show placeholder via CSS
            fontSize: 16,
            color: '#ffffff'
        };
        
        this.elements.push(textBlock);
        this.renderElements();
        this.pushState();
        this.saveToStorage();
    }

    addImageBlock(dataUrl, x, y) {
        const imageBlock = {
            id: Date.now(),
            type: 'image',
            x: x,
            y: y,
            width: 200,
            height: 200,
            src: dataUrl,
            rotation: 0
        };
        
        this.elements.push(imageBlock);
        this.renderElements();
        this.pushState();
        this.saveToStorage();
    }

    renderElements() {
        if (!this.elementsContainer) return;
        
        this.elementsContainer.innerHTML = '';
        
        for (let element of this.elements) {
            const el = document.createElement('div');
            el.className = `board-element board-element-${element.type}`;
            
            // Apply selection class
            if (this.selectedElements.some(sel => sel.id === element.id)) {
                el.classList.add('selected');
            }

            el.dataset.id = element.id;
            el.style.left = element.x + 'px';
            el.style.top = element.y + 'px';
            el.style.width = element.width + 'px';
            el.style.height = element.height + 'px';
            
            // Apply rotation
            if (element.rotation) {
                el.style.transform = `rotate(${element.rotation}deg)`;
            }

            // FIX: Add explicit listener for dragging/selecting (Critical for duplicates)
            el.addEventListener('mousedown', (e) => this.handleElementMouseDown(e));
            
            if (element.type === 'text') {
                const textContent = document.createElement('div');
                textContent.className = 'text-content';
                textContent.contentEditable = 'false';
                textContent.textContent = element.content;
                el.appendChild(textContent);
                
                // Edit on double-click: Removed in favor of Single Click Edit (Custom Logic)
                // The blur handler is now attached dynamically when edit mode starts.
            } else if (element.type === 'image') {
                const img = document.createElement('img');
                img.src = element.src;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'fill'; // FIX: Stretch image to fill container
                img.style.pointerEvents = 'none'; // FIX: Let clicks pass through to parent
                img.style.borderRadius = '8px'; // Match parent radius
                el.appendChild(img);
            } else if (element.type === 'drawing') {
                // Render drawing as SVG path
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.overflow = 'visible';
                // REMOVED: pointer-events: none (Managed by setTool)
                
                // FIX: Use width/height (standardized properties)
                const w = element.width || element.boundingWidth || 100;
                const h = element.height || element.boundingHeight || 100;
                svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Convert points to SVG path data (relative to element position)
                const minX = element.x; 
                const minY = element.y;
                let pathData = '';
                element.points.forEach((point, i) => {
                    const x = point.x - minX;
                    const y = point.y - minY;
                    pathData += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                });
                
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', element.color);
                
                let sWidth = element.strokeWidth;
                if (!sWidth) {
                    if (element.width && element.width < 50) sWidth = element.width;
                    else sWidth = 3; 
                }
                
                path.setAttribute('stroke-width', sWidth);
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('fill', 'none');
                
                svg.appendChild(path);
                el.appendChild(svg);
                
                el.style.width = (element.width || element.boundingWidth || 100) + 'px';
                el.style.height = (element.height || element.boundingHeight || 100) + 'px';
            }
            
            // Add resize handles for images and text when selected
            if ((element.type === 'image' || element.type === 'text') && 
                this.selectedElements.some(sel => sel.id === element.id)) {
                
                // Rotation Handle
                const rotateHandle = document.createElement('div');
                rotateHandle.className = 'rotate-handle';
                rotateHandle.addEventListener('mousedown', (e) => {
                    this.startRotate(element, e);
                });
                el.appendChild(rotateHandle);

                // 8 Directional Handles
                const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
                
                directions.forEach(dir => {
                    const handle = document.createElement('div');
                    handle.className = `resize-handle handle-${dir}`;
                    handle.dataset.dir = dir;

                    // Dynamic Cursor Calculation
                    const cursor = this.getCursorForHandle(dir, element.rotation || 0);
                    handle.style.cursor = cursor;
                    
                    handle.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                        this.startResize(element, e, dir);
                    });
                    
                    el.appendChild(handle);
                });
            }
            
            this.elementsContainer.appendChild(el);
        }
    }

    getCursorForHandle(dir, rotation) {
        const baseAngles = {
            'n': 0,
            'ne': 45,
            'e': 90,
            'se': 135,
            's': 180,
            'sw': 225,
            'w': 270,
            'nw': 315
        };

        let angle = (baseAngles[dir] + rotation) % 360;
        if (angle < 0) angle += 360;

        // Snap to nearest 45
        // 0, 180 -> ns-resize
        // 90, 270 -> ew-resize
        // 45, 225 -> nesw-resize
        // 135, 315 -> nwse-resize

        // Normalize to 0-180 for simpler checks (cursors are symmetric)
        let effectiveAngle = angle % 180;

        if (effectiveAngle >= 22.5 && effectiveAngle < 67.5) {
            return 'nesw-resize';
        } else if (effectiveAngle >= 67.5 && effectiveAngle < 112.5) {
            return 'ew-resize';
        } else if (effectiveAngle >= 112.5 && effectiveAngle < 157.5) {
            return 'nwse-resize';
        } else {
            return 'ns-resize';
        }
    }

    selectElement(element) {
        // Clear previous selection
        this.selectedElements = [element];
        
        // Full re-render to ensure handles are created/destroyed
        this.renderElements();
        
        // Show delete button in toolbar
        this.updateToolbar();
    }

    startResize(element, e, direction) {
        this.isResizing = true;
        this.resizingElement = element;
        this.resizeHandleType = direction;
        
        // Transform mouse point to account for rotation
        // Actually simpler: Work with unrotated coordinates logic if possible, 
        // OR just simple delta logic for N/S/E/W/corners
        
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: element.width,
            height: element.height,
            elementX: element.x,
            elementY: element.y,
            rotation: element.rotation || 0
        };
        
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.handleResizeEnd);
    }

    rotatePoint(x, y, cx, cy, angle) {
        const radians = angle * (Math.PI / 180);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
        const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return { x: nx, y: ny };
    }

    startRotate(element, e) {
        e.stopPropagation(); // Don't drag
        e.preventDefault(); // Prevent text selection/drag behaviors
        this.isRotating = true;
        this.resizingElement = element;
        
        // Calculate center of element on screen
        const elDOM = document.querySelector(`.board-element[data-id="${element.id}"]`);
        if (!elDOM) return;
        
        const rect = elDOM.getBoundingClientRect();
        
        this.rotateStart = {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            initialRotation: element.rotation || 0,
            startAngle: Math.atan2(e.clientY - (rect.top + rect.height/2), e.clientX - (rect.left + rect.width/2))
        };

        document.addEventListener('mousemove', this.handleRotate);
        document.addEventListener('mouseup', this.handleRotateEnd);
    }

    handleRotate = (e) => {
        if (!this.isRotating || !this.resizingElement) return;

        const currentAngle = Math.atan2(e.clientY - this.rotateStart.centerY, e.clientX - this.rotateStart.centerX);
        let rotationChange = (currentAngle - this.rotateStart.startAngle) * (180 / Math.PI);
        
        let newRotation = this.rotateStart.initialRotation + rotationChange;
        
        // Normalize rotation to 0-360 range for cleaner math
        let normalizedRot = newRotation % 360;
        if (normalizedRot < 0) normalizedRot += 360;

        // Snap Logic
        const snapThreshold = 10; // Increased to 10 for easier snapping
        let snapped = false;
        
        // Check cardinal directions (0, 90, 180, 270, 360)
        const snapAngles = [0, 90, 180, 270, 360];
        for (let angle of snapAngles) {
            if (Math.abs(normalizedRot - angle) < snapThreshold) {
                newRotation = Math.round(newRotation / 90) * 90; // Snap to nearest 90
                snapped = true;
                break;
            }
        }

        // Shift key overrides auto-snap with 45-degree increments
        if (e.shiftKey) {
            newRotation = Math.round(newRotation / 45) * 45;
            snapped = false; // Don't show "straight" guide for 45s unless it aligns with 90s
            if (newRotation % 90 === 0) snapped = true;
        }

        this.resizingElement.rotation = newRotation;
        
        // Update ONLY rotation visually
        const el = document.querySelector(`.board-element[data-id="${this.resizingElement.id}"]`);
        if (el) {
            el.style.transform = `rotate(${newRotation}deg)`;
            
            // Update cursors for all handles on this element
            const handles = el.querySelectorAll('.resize-handle');
            handles.forEach(handle => {
                const dir = handle.dataset.dir;
                if (dir) {
                    handle.style.cursor = this.getCursorForHandle(dir, newRotation);
                }
            });
        }

        // Show/Hide Guide
        if (snapped) {
            this.showSnapGuide(this.resizingElement);
        } else {
            this.hideSnapGuide();
        }
    }

    handleRotateEnd = () => {
        if (this.isRotating) {
            this.isRotating = false;
            this.resizingElement = null;
            this.hideSnapGuide(); // Clear guide
            this.saveToStorage();
            document.removeEventListener('mousemove', this.handleRotate);
            document.removeEventListener('mouseup', this.handleRotateEnd);
        }
    }

    showSnapGuide(element) {
        // Create guide if it doesn't exist
        let guide = document.getElementById('rotation-snap-guide');
        if (!guide) {
            guide = document.createElement('div');
            guide.id = 'rotation-snap-guide';
            guide.className = 'snap-guide-line horizontal'; // Default horizontal
            // Append to .planning-board-viewport NOT element container so it spans screen
            const viewport = document.querySelector('.planning-board-viewport');
            if (viewport) viewport.appendChild(guide);
        }

        guide.style.display = 'block';
        
        // Position guide line through the center of the element
        // Get Screen Coordinates of element center
        const elDOM = document.querySelector(`.board-element[data-id="${element.id}"]`);
        if (!elDOM) return;
        const rect = elDOM.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Get Viewport relative coords safely
        const viewport = document.querySelector('.planning-board-viewport');
        if (!viewport) return;
        const viewportRect = viewport.getBoundingClientRect();
        
        const relX = centerX - viewportRect.left;
        const relY = centerY - viewportRect.top;

        // Determine orientation based on rotation
        const rot = Math.abs(element.rotation % 180);
        if (rot < 45 || rot > 135) {
             // Landscape-ish (0 or 180) -> Horizontal Line
             guide.className = 'snap-guide-line horizontal';
             guide.style.top = relY + 'px';
             guide.style.left = '0px';
             guide.style.width = '100%';
             guide.style.height = '1px';
        } else {
             // Portrait-ish (90 or 270) -> Vertical Line
             guide.className = 'snap-guide-line vertical';
             guide.style.left = relX + 'px';
             guide.style.top = '0px';
             guide.style.height = '100%';
             guide.style.width = '1px';
        }
    }

    hideSnapGuide() {
        const guide = document.getElementById('rotation-snap-guide');
        if (guide) {
            guide.style.display = 'none';
        }
    }

    handleResize = (e) => {
        if (!this.isResizing || !this.resizingElement) return;
        
        const scale = this.viewState.scale;
        
        // 1. Calculate Delta in Local Space
        const dxScreen = (e.clientX - this.resizeStart.x) / scale;
        const dyScreen = (e.clientY - this.resizeStart.y) / scale;
        
        // Convert screen delta to local delta (inverse rotation)
        // CSS rotation is clockwise. Math rotation is usually CCW.
        // We want to project screen vector onto local X/Y axes.
        const rot = this.resizeStart.rotation || 0;
        const rad = rot * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // Inverse rotation (transpose matrix)
        const dxLocal = dxScreen * cos + dyScreen * sin;
        const dyLocal = -dxScreen * sin + dyScreen * cos;

        const type = this.resizeHandleType;
        const el = this.resizingElement;
        
        let newW = this.resizeStart.width;
        let newH = this.resizeStart.height;

        // 2. Calculate New Dimensions based on Handle Type
        if (type.includes('e')) newW += dxLocal;
        if (type.includes('w')) newW -= dxLocal;
        if (type.includes('s')) newH += dyLocal;
        if (type.includes('n')) newH -= dyLocal;

        // Constraints
        if (newW < 20) newW = 20;
        if (newH < 20) newH = 20;

        // 3. Anchor Point Logic to Prevent Drift
        // We determine which point in LOCAL space should remain FIXED in SCREEN space.
        // E.g. if dragging 'n', the 's' point (bottom-center) is the anchor.
        
        // Local coordinates of the anchor point (0..1 relative to width/height)
        let anchorRatioX = 0.5;
        let anchorRatioY = 0.5;

        // If 'w', anchor is 'e' (1.0), etc.
        if (type.includes('w')) anchorRatioX = 1.0; 
        else if (type.includes('e')) anchorRatioX = 0.0;
        
        if (type.includes('n')) anchorRatioY = 1.0;
        else if (type.includes('s')) anchorRatioY = 0.0;
        
        // Calculate the offsets of the anchor from the CENTER in the OLD box
        const oldW = this.resizeStart.width;
        const oldH = this.resizeStart.height;
        const oldCenterX = this.resizeStart.elementX + oldW / 2;
        const oldCenterY = this.resizeStart.elementY + oldH / 2;
        
        const localAnchorX_Old = (anchorRatioX - 0.5) * oldW;
        const localAnchorY_Old = (anchorRatioY - 0.5) * oldH;
        
        // Rotate this offset to get Screen offset from Center
        const screenAnchorOffsetX = localAnchorX_Old * cos - localAnchorY_Old * sin;
        const screenAnchorOffsetY = localAnchorX_Old * sin + localAnchorY_Old * cos;
        
        // Current Screen Position of the Anchor (The Fixed Point)
        const anchorScreenX = oldCenterX + screenAnchorOffsetX;
        const anchorScreenY = oldCenterY + screenAnchorOffsetY;
        
        // Now calculate where the NEW Center must be to keep this Anchor fixed
        const localAnchorX_New = (anchorRatioX - 0.5) * newW;
        const localAnchorY_New = (anchorRatioY - 0.5) * newH;
        
        const screenAnchorOffsetX_New = localAnchorX_New * cos - localAnchorY_New * sin;
        const screenAnchorOffsetY_New = localAnchorX_New * sin + localAnchorY_New * cos;
        
        // New Center = AnchorScreen - NewRotatedOffset
        const newCenterX = anchorScreenX - screenAnchorOffsetX_New;
        const newCenterY = anchorScreenY - screenAnchorOffsetY_New;
        
        // New Top-Left
        const newX = newCenterX - newW / 2;
        const newY = newCenterY - newH / 2;

        // Apply Changes
        el.width = newW;
        el.height = newH;
        el.x = newX;
        el.y = newY;

        this.renderElements();
    }

    handleResizeEnd = () => {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizingElement = null;
            this.resizeHandleType = null;
            this.saveToStorage();
            
            document.removeEventListener('mousemove', this.handleResize);
            document.removeEventListener('mouseup', this.handleResizeEnd);
        }
    }


    deleteSelected() {
        if (!this.selectedElements || this.selectedElements.length === 0) return;
        
        // Remove selected elements
        const selectedIds = this.selectedElements.map(el => el.id);
        this.elements = this.elements.filter(el => !selectedIds.includes(el.id));
        
        // Clear selection
        this.selectedElements = [];
        
        // Update UI
        this.renderElements();
        this.updateToolbar();
        this.pushState();
        this.saveToStorage();
    }


    duplicateSelected() {
        if (!this.selectedElements || this.selectedElements.length === 0) return;
        
        const newElements = this.selectedElements.map(el => {
            // Create deep copy
            const newEl = JSON.parse(JSON.stringify(el));
            newEl.id = Date.now() + Math.random(); // New ID
            newEl.x += 20; // Offset position
            newEl.y += 20;
            return newEl;
        });
        
        this.elements.push(...newElements);
        
        // Select the new copies
        this.selectedElements = newElements;
        
        // Update UI
        this.renderElements();
        this.pushState();
        this.saveToStorage();
        
        // Highlight selection
        this.selectedElements.forEach(el => this.selectElement(el)); // Re-select involves UI logic
    }

    saveToStorage() {
        const data = {
            elements: this.elements,
            viewState: this.viewState
        };
        localStorage.setItem('planning_board_data', JSON.stringify(data));
    }

    loadFromStorage() {
        const data = localStorage.getItem('planning_board_data');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.elements = parsed.elements || [];
                
                // Migrate old drawingPaths to new element format
                if (parsed.drawingPaths && parsed.drawingPaths.length > 0) {
                    parsed.drawingPaths.forEach(path => {
                        const minX = Math.min(...path.points.map(p => p.x)) - 10;
                        const minY = Math.min(...path.points.map(p => p.y)) - 10;
                        const maxX = Math.max(...path.points.map(p => p.x)) + 10;
                        const maxY = Math.max(...path.points.map(p => p.y)) + 10;
                        
                        this.elements.push({
                            id: Date.now() + Math.random(),
                            type: 'drawing',
                            points: path.points,
                            color: path.color,
                            width: path.width,
                            tool: path.tool,
                            x: minX,
                            y: minY,
                            boundingWidth: maxX - minX,
                            boundingHeight: maxY - minY
                        });
                    });
                    // Save migrated data
                    this.saveToStorage();
                }
                
                if (parsed.viewState) {
                    this.viewState = { 
                        ...this.viewState, 
                        ...parsed.viewState 
                    };
                    // Validation: Ensure no nulls and reasonable bounds
                    this.viewState.scale = Math.max(0.5, this.viewState.scale || 1); // Auto-fix tiny zoom
                    this.viewState.offsetX = this.viewState.offsetX || 0;
                    this.viewState.offsetY = this.viewState.offsetY || 0;
                }
                this.renderElements();
                this.render();
            } catch (e) {
                console.error('Failed to load board data:', e);
            }
        }
    }

    // Board File Management Methods
    async saveBoard() {
        if (this.currentBoardPath) {
            await this.saveBoardToFile(this.currentBoardPath);
        } else {
            await this.saveAsBoard();
        }
    }

    async saveAsBoard() {
        const result = await window.electron.invoke('board-show-save-dialog');
        
        if (!result.canceled && result.filePath) {
            await this.saveBoardToFile(result.filePath);
        }
    }

    async saveBoardToFile(filePath) {
        const boardData = {
            version: '1.0',
            boardName: this.currentBoardName,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            elements: this.elements,
            viewState: this.viewState
        };

        const result = await window.electron.invoke('board-save-file', filePath, boardData);
        
        if (result.success) {
            this.currentBoardPath = filePath;
            this.currentBoardName = filePath.split(/[\\/]/).pop().replace('.board', '');
            this.hasUnsavedChanges = false;
            this.updateBoardTitleUI(); // FIX: Update header title
            console.log('Board saved successfully:', filePath);
        } else {
            alert('Error saving board: ' + result.error);
        }
    }

    async openBoard() {
        if (this.hasUnsavedChanges) {
            const shouldSave = await this.promptSaveChanges();
            if (shouldSave === 'cancel') return;
            if (shouldSave === 'save') await this.saveBoard();
        }

        const result = await window.electron.invoke('board-show-open-dialog');
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            await this.loadBoardFromFile(result.filePaths[0]);
        }
    }

    async loadBoardFromFile(filePath) {
        const result = await window.electron.invoke('board-load-file', filePath);
        
        if (result.success) {
            const boardData = result.data;
            
            // Validate board data
            if (!boardData.version || !boardData.elements) {
                alert('Invalid board file format');
                return;
            }

            // Load board data
            this.elements = boardData.elements || [];
            this.viewState = boardData.viewState || { scale: 1, offsetX: 0, offsetY: 0 };
            this.currentBoardPath = filePath;
            this.currentBoardName = filePath.split(/[\\/]/).pop().replace('.board', '');
            this.hasUnsavedChanges = false;
            this.selectedElements = [];

            // Reset to select tool
            this.setTool('select');
            this.updateToolButtons();

            // Update UI
            this.renderElements();
            this.updateTransform();
            this.updateBoardTitleUI(); // FIX: Update header title
            this.saveToStorage();
            
            console.log('Board loaded successfully:', filePath);
        } else {
            alert('Error loading board: ' + result.error);
        }
    }

    async newBoard() {
        // FIX: Ensure DOM connections are alive before doing anything
        this.setupCanvas();
        this.setupEventListeners();

        if (this.hasUnsavedChanges) {

            const shouldSave = await this.promptSaveChanges();
            if (shouldSave === 'cancel') return;
            if (shouldSave === 'save') await this.saveBoard();
        }

        // Clear board
        this.elements = [];
        this.viewState = { scale: 1, offsetX: 0, offsetY: 0 };
        this.currentBoardPath = null;
        this.currentBoardName = 'Untitled'; // Reset name
        this.hasUnsavedChanges = false;
        this.selectedElements = [];

        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Reset to select tool
        this.setTool('select');
        this.updateToolButtons();

        // Update UI
        this.renderElements();
        this.updateTransform();
        this.updateBoardTitleUI(); // FIX: Update header title
        this.saveToStorage();
        
        console.log('New board created');
    }

    // FIX: Helper to update board name in header
    updateBoardTitleUI() {
        const titleEl = document.getElementById('active-board-name');
        if (titleEl) {
            let displayName = this.currentBoardName || 'Untitled Board';
            if (displayName === 'Untitled') displayName = 'Untitled Board';
            titleEl.textContent = displayName;
        }
    }

    async promptSaveChanges() {
        return new Promise((resolve) => {
            const result = confirm(`Save changes to "${this.currentBoardName}"?\n\nClick OK to save, Cancel to discard changes.`);
            if (result) {
                resolve('save');
            } else {
                const discard = confirm('Are you sure you want to discard unsaved changes?');
                resolve(discard ? 'dont-save' : 'cancel');
            }
        });
    }

    markUnsaved() {
        this.hasUnsavedChanges = true;
    }

    activate() {
        // Called when Planning Board is opened
        console.log('Board Activate Signal Received');
        
        // Brief delay to ensure CSS transitions/layout are finalized
        setTimeout(() => {
            this.init();
            
            // Restore tool state (this fixes pointer-events being reset)
            this.setTool(this.currentTool || 'select');
            this.updateToolButtons();
            console.log('Board Activation Complete');
            
            // Push initial state if history empty
            if (this.history.length === 0 && this.elements.length > 0) {
                 this.pushState(true);
            }
        }, 300);
    }

    // HISTORY API
    pushState(skipSave = false) {
        // Remove 'future' history if we are in the middle of the stack
        if (this.historyStep < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyStep + 1);
        }
        
        // Deep copy elements
        const state = JSON.stringify(this.elements);
        
        // Don't push identical states
        if (this.history.length > 0 && this.history[this.history.length - 1] === state) {
            return;
        }

        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift(); // Remove oldest
        } else {
            this.historyStep++;
        }
        
        if (!skipSave) this.saveToStorage();
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            const previousState = JSON.parse(this.history[this.historyStep]);
            this.elements = previousState;
            this.renderElements();
            this.saveToStorage();
            console.log('Undo:', this.historyStep);
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            const nextState = JSON.parse(this.history[this.historyStep]);
            this.elements = nextState;
            this.renderElements();
            this.saveToStorage();
            console.log('Redo:', this.historyStep);
        }
    }
}

// Export for use in renderer.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanningBoard;
}
