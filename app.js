// Hexagonal Grid Canvas with Pan, Zoom, and Audio
class HexGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        
        // Hexagon properties
        this.hexSize = 40;
        this.hexWidth = Math.sqrt(3) * this.hexSize;
        this.hexHeight = 2 * this.hexSize;
        
        // Interaction state
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.touches = new Map();
        this.activeCells = new Map();
        
        // Audio context
        this.audioContext = null;
        this.initAudio();
        
        // Colors for visual feedback
        this.cellColors = new Map();
        
        this.init();
    }
    
    init() {
        this.resize();
        this.setupEventListeners();
        this.animate();
    }
    
    initAudio() {
        // Create audio context on first user interaction
        const startAudio = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            document.removeEventListener('touchstart', startAudio);
            document.removeEventListener('mousedown', startAudio);
        };
        document.addEventListener('touchstart', startAudio, { once: true });
        document.addEventListener('mousedown', startAudio, { once: true });
    }
    
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
    }
    
    // Hexagon math
    axialToPixel(q, r) {
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexSize * (3 / 2 * r);
        return { x, y };
    }
    
    pixelToAxial(x, y) {
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / this.hexSize;
        const r = (2 / 3 * y) / this.hexSize;
        return this.axialRound(q, r);
    }
    
    axialRound(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);
        
        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);
        
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        
        return { q: rq, r: rr };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.width / 2) / this.camera.zoom - this.camera.x,
            y: (screenY - this.height / 2) / this.camera.zoom - this.camera.y
        };
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX + this.camera.x) * this.camera.zoom + this.width / 2,
            y: (worldY + this.camera.y) * this.camera.zoom + this.height / 2
        };
    }
    
    // Draw a hexagon
    drawHexagon(x, y, q, r, highlight = false) {
        const key = `${q},${r}`;
        const color = this.cellColors.get(key);
        
        this.ctx.save();
        this.ctx.beginPath();
        
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const hx = x + this.hexSize * Math.cos(angle);
            const hy = y + this.hexSize * Math.sin(angle);
            
            if (i === 0) {
                this.ctx.moveTo(hx, hy);
            } else {
                this.ctx.lineTo(hx, hy);
            }
        }
        
        this.ctx.closePath();
        
        // Fill
        if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fill();
        } else if (highlight) {
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            this.ctx.fill();
        }
        
        // Stroke
        this.ctx.strokeStyle = highlight ? '#4dd0e1' : '#2a2a4e';
        this.ctx.lineWidth = 2 / this.camera.zoom;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    // Get visible hexagons
    getVisibleHexagons() {
        const hexagons = [];
        
        // Calculate visible area in world coordinates
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.width, this.height);
        
        // Calculate range of hexagons to draw
        const minQ = Math.floor((topLeft.x - this.hexSize * 2) / this.hexWidth) - 2;
        const maxQ = Math.ceil((bottomRight.x + this.hexSize * 2) / this.hexWidth) + 2;
        const minR = Math.floor((topLeft.y - this.hexSize * 2) / (this.hexSize * 1.5)) - 2;
        const maxR = Math.ceil((bottomRight.y + this.hexSize * 2) / (this.hexSize * 1.5)) + 2;
        
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const pos = this.axialToPixel(q, r);
                const screenPos = this.worldToScreen(pos.x, pos.y);
                
                // Only include if on screen (with margin)
                if (screenPos.x > -this.hexSize * 3 && screenPos.x < this.width + this.hexSize * 3 &&
                    screenPos.y > -this.hexSize * 3 && screenPos.y < this.height + this.hexSize * 3) {
                    hexagons.push({ q, r, x: screenPos.x, y: screenPos.y });
                }
            }
        }
        
        return hexagons;
    }
    
    // Mouse handlers
    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        
        // Check if clicking on a hexagon
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const hex = this.pixelToAxial(worldPos.x, worldPos.y);
        this.playTone(hex.q, hex.r);
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            
            this.camera.x += dx / this.camera.zoom;
            this.camera.y += dy / this.camera.zoom;
            
            this.lastMousePos = { x: e.clientX, y: e.clientY };
        }
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.camera.zoom * zoomFactor));
        
        // Zoom towards mouse position
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const worldPosBefore = this.screenToWorld(mouseX, mouseY);
        this.camera.zoom = newZoom;
        const worldPosAfter = this.screenToWorld(mouseX, mouseY);
        
        this.camera.x += worldPosBefore.x - worldPosAfter.x;
        this.camera.y += worldPosBefore.y - worldPosAfter.y;
    }
    
    // Touch handlers
    handleTouchStart(e) {
        e.preventDefault();
        
        for (let touch of e.changedTouches) {
            const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
            const hex = this.pixelToAxial(worldPos.x, worldPos.y);
            
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                hex: hex
            });
            
            this.playTone(hex.q, hex.r);
        }
        
        // Handle pinch zoom initialization
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.initialPinchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            this.initialZoom = this.camera.zoom;
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            // Single touch - pan
            const touch = e.touches[0];
            const lastTouch = this.touches.get(touch.identifier);
            
            if (lastTouch) {
                const dx = touch.clientX - lastTouch.x;
                const dy = touch.clientY - lastTouch.y;
                
                this.camera.x += dx / this.camera.zoom;
                this.camera.y += dy / this.camera.zoom;
                
                this.touches.set(touch.identifier, {
                    x: touch.clientX,
                    y: touch.clientY,
                    hex: lastTouch.hex
                });
            }
        } else if (e.touches.length === 2) {
            // Two touches - pinch zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (this.initialPinchDistance) {
                const scale = distance / this.initialPinchDistance;
                this.camera.zoom = Math.max(0.1, Math.min(5, this.initialZoom * scale));
            }
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        for (let touch of e.changedTouches) {
            const touchData = this.touches.get(touch.identifier);
            if (touchData && touchData.hex) {
                const key = `${touchData.hex.q},${touchData.hex.r}`;
                this.stopTone(key);
            }
            this.touches.delete(touch.identifier);
        }
        
        if (e.touches.length < 2) {
            this.initialPinchDistance = null;
        }
    }
    
    // Audio synthesis
    playTone(q, r) {
        if (!this.audioContext) return;
        
        const key = `${q},${r}`;
        
        // Stop existing tone if any
        this.stopTone(key);
        
        // Calculate frequency based on hexagon position
        const baseFreq = 220; // A3
        const qFreq = baseFreq * Math.pow(2, (q % 12) / 12);
        const rFreq = baseFreq * Math.pow(2, (r % 12) / 12);
        const frequency = (qFreq + rFreq) / 2;
        
        // Create oscillator
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.01);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        
        // Store active oscillator
        this.activeCells.set(key, { oscillator, gainNode });
        
        // Set color for visual feedback
        const hue = (q * 30 + r * 50) % 360;
        this.cellColors.set(key, `hsla(${hue}, 70%, 50%, 0.5)`);
        
        // Auto-fade after a moment if not touched
        setTimeout(() => {
            if (this.activeCells.has(key)) {
                this.stopTone(key);
            }
        }, 2000);
    }
    
    stopTone(key) {
        const cell = this.activeCells.get(key);
        if (cell) {
            const { oscillator, gainNode } = cell;
            const currentTime = this.audioContext.currentTime;
            
            gainNode.gain.cancelScheduledValues(currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.1);
            
            oscillator.stop(currentTime + 0.1);
            this.activeCells.delete(key);
            
            // Fade out color
            setTimeout(() => {
                this.cellColors.delete(key);
            }, 100);
        }
    }
    
    // Render loop
    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw hexagons
        const hexagons = this.getVisibleHexagons();
        for (let hex of hexagons) {
            const key = `${hex.q},${hex.r}`;
            const isActive = this.activeCells.has(key);
            this.drawHexagon(hex.x, hex.y, hex.q, hex.r, isActive);
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the application
const canvas = document.getElementById('canvas');
const hexGrid = new HexGrid(canvas);
