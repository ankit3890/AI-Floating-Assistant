const canvas = document.getElementById('selection-canvas');
const ctx = canvas.getContext('2d');
const img = document.getElementById('screenshot-layer');

let isDragging = false;
let startX = 0;
let startY = 0;

// Initialize
window.electronAPI.onShowCapture((dataUrl) => {
    img.src = dataUrl;
    
    // Sync canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Darken overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// Mouse Events
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = currentX - startX;
    const height = currentY - startY;
    
    // Clear selection area (make it transparent)
    ctx.clearRect(startX, startY, width, height);
    
    // Draw border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, width, height);
});

canvas.addEventListener('mouseup', async (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    let x = Math.min(startX, endX);
    let y = Math.min(startY, endY);
    let width = Math.abs(endX - startX);
    let height = Math.abs(endY - startY);
    
    if (width < 10 || height < 10) {
        // Assume accidental click, reset
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }
    
    // Capture Crop
    const tempCanvas = document.createElement('canvas');
    
    // Scale Coordinates to match Physical Image
    // Window coordinates (CSS Pixels) -> Image Coordinates (Physical Pixels)
    const scaleX = img.naturalWidth / window.innerWidth;
    const scaleY = img.naturalHeight / window.innerHeight;
    
    // Use the lowest scale to keep aspect ratio if needed, but for full screen fit, 
    // we should trust exact mapping unless object-fit interferes.
    // Since we forced object-fit: contain (default) or fill, let's verify.
    // Actually, simply mapping proportionality is safest for 'fill' or 'cover' or just 100% 100%.
    // Our CSS says object-fit: contain. But we want 1:1 if aspect matches.
    
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;
    
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    try {
        tempCtx.drawImage(
            img, 
            scaledX, scaledY, scaledWidth, scaledHeight, // Source Crop
            0, 0, scaledWidth, scaledHeight              // Dest Draw
        );
        
        const capturedData = tempCanvas.toDataURL('image/png');
        window.electronAPI.completeCapture(capturedData);
    } catch (err) {
        console.error("Crop failed", err);
        // Fallback or cancel?
        window.electronAPI.cancelCapture();
    }
});

// ESC to Cancel
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.electronAPI.cancelCapture();
    }
});

// Resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
