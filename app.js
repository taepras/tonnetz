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
        
        // Hexagon properties (flat-top orientation)
        this.baseHexSize = 60;
        this.hexSize = this.baseHexSize; // Will scale with zoom
        this.hexWidth = 2 * this.hexSize;
        this.hexHeight = Math.sqrt(3) * this.hexSize;
        
        // Interaction state
        this.enablePanZoom = false; // Flag to enable/disable panning and zooming
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.touches = new Map();
        this.activeCells = new Map();
        
        // Audio context
        this.audioContext = null;
        this.initAudio();
        
        // Colors for visual feedback
        this.cellColors = new Map();
        
        // Joystick properties
        this.joystick = {
            baseX: 100,
            baseY: window.innerHeight - 100,
            baseRadius: 50,
            stickRadius: 20,
            stickX: 0,
            stickY: 0,
            active: false,
            touchId: null,
            maxDistance: 40
        };
        
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
        
        // Update joystick position
        this.joystick.baseY = this.height - 100;
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
    
    // Hexagon math (flat-top orientation)
    axialToPixel(q, r) {
        const x = this.baseHexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.baseHexSize * (3 / 2 * r);
        return { x, y };
    }
    
    pixelToAxial(x, y) {
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / this.baseHexSize;
        const r = (2 / 3 * y) / this.baseHexSize;
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
        
        // Scale hex size with zoom
        const scaledSize = this.baseHexSize * this.camera.zoom;
        
        this.ctx.save();
        this.ctx.beginPath();
        
        // Flat-top hexagon (rotated 90 degrees from pointy-top)
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 6; // Offset by 30 degrees for flat-top
            const hx = x + scaledSize * Math.cos(angle);
            const hy = y + scaledSize * Math.sin(angle);
            
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
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw text labels
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.floor(12 * this.camera.zoom)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        // this.ctx.fillText(`${q},${r}`, x, y);

        const numerator = (q > 0 ? Math.pow(3, q) : Math.pow(2, -q)) * (r > 0 ? Math.pow(5, r) : Math.pow(4, -r));
        const denominator = (q > 0 ? Math.pow(2, q) : Math.pow(3, -q)) * (r > 0 ? Math.pow(4, r) : Math.pow(5, -r));
        const simplified = this.simplifyFraction(numerator, denominator);
        const fracText = `${simplified.numerator}/${simplified.denominator}`;
        this.ctx.fillText(fracText, x, y - 5);

        this.ctx.fillStyle = '#ffffff66';
        this.ctx.fillText((simplified.numerator / simplified.denominator).toFixed(2), x, y + 12);
        
        this.ctx.restore();
    }

    simplifyFraction(numerator, denominator) {
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(numerator, denominator);
        return {
            numerator: numerator / divisor,
            denominator: denominator / divisor
        };
    }
    
    // Get visible hexagons
    getVisibleHexagons() {
        const hexagons = [];
        
        // Calculate visible area in world coordinates
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.width, this.height);
        
        // Calculate range of hexagons to draw (flat-top orientation)
        const hexSpacingX = this.baseHexSize * Math.sqrt(3);
        const hexSpacingY = this.baseHexSize * 1.5;
        
        const minQ = Math.floor(topLeft.x / hexSpacingX) - 2;
        const maxQ = Math.ceil(bottomRight.x / hexSpacingX) + 2;
        const minR = Math.floor(topLeft.y / hexSpacingY) - 2;
        const maxR = Math.ceil(bottomRight.y / hexSpacingY) + 2;
        
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const pos = this.axialToPixel(q, r);
                const screenPos = this.worldToScreen(pos.x, pos.y);
                
                // Only include if on screen (with margin)
                const margin = this.baseHexSize * this.camera.zoom * 2;
                if (screenPos.x > -margin && screenPos.x < this.width + margin &&
                    screenPos.y > -margin && screenPos.y < this.height + margin) {
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
        if (this.isDragging && this.enablePanZoom) {
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
        
        if (!this.enablePanZoom) return;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.5, Math.min(5, this.camera.zoom * zoomFactor));
        
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
            // Check if touch is on joystick
            const dx = touch.clientX - this.joystick.baseX;
            const dy = touch.clientY - this.joystick.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.joystick.baseRadius) {
                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;
                this.joystick.stickX = dx;
                this.joystick.stickY = dy;
                continue;
            }
            
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
            this.lastPinchCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        // Handle joystick movement
        for (let touch of e.touches) {
            if (this.joystick.active && touch.identifier === this.joystick.touchId) {
                const dx = touch.clientX - this.joystick.baseX;
                const dy = touch.clientY - this.joystick.baseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > this.joystick.maxDistance) {
                    const angle = Math.atan2(dy, dx);
                    this.joystick.stickX = Math.cos(angle) * this.joystick.maxDistance;
                    this.joystick.stickY = Math.sin(angle) * this.joystick.maxDistance;
                } else {
                    this.joystick.stickX = dx;
                    this.joystick.stickY = dy;
                }
                
                // Pan camera based on joystick
                const panSpeed = 5;
                this.camera.x += (this.joystick.stickX / this.joystick.maxDistance) * panSpeed;
                this.camera.y += (this.joystick.stickY / this.joystick.maxDistance) * panSpeed;
                return;
            }
        }
        
        if (e.touches.length === 1) {
            // Single touch - pan
            const touch = e.touches[0];
            const lastTouch = this.touches.get(touch.identifier);
            
            if (lastTouch && this.enablePanZoom) {
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
        } else if (e.touches.length === 2 && this.enablePanZoom) {
            // Two touches - pinch zoom and pan
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            const currentCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            
            if (this.initialPinchDistance && this.enablePanZoom) {
                const scale = distance / this.initialPinchDistance;
                this.camera.zoom = Math.max(0.5, Math.min(5, this.initialZoom * scale));
            }
            
            // Pan based on center point movement
            if (this.lastPinchCenter && this.enablePanZoom) {
                const dx = currentCenter.x - this.lastPinchCenter.x;
                const dy = currentCenter.y - this.lastPinchCenter.y;
                
                this.camera.x += dx / this.camera.zoom;
                this.camera.y += dy / this.camera.zoom;
            }
            
            this.lastPinchCenter = currentCenter;
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        for (let touch of e.changedTouches) {
            // Check if joystick was released
            if (this.joystick.active && touch.identifier === this.joystick.touchId) {
                this.joystick.active = false;
                this.joystick.touchId = null;
                this.joystick.stickX = 0;
                this.joystick.stickY = 0;
                continue;
            }
            
            const touchData = this.touches.get(touch.identifier);
            if (touchData && touchData.hex) {
                const key = `${touchData.hex.q},${touchData.hex.r}`;
                this.stopTone(key);
            }
            this.touches.delete(touch.identifier);
        }
        
        if (e.touches.length < 2) {
            this.initialPinchDistance = null;
            this.lastPinchCenter = null;
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
        const qFreq = Math.pow(1.5, q);
        const rFreq = Math.pow(1.25, r);
        const frequency = baseFreq * qFreq * rFreq;
        
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
    
    // Draw joystick
    drawJoystick() {
        this.ctx.save();
        
        // Draw base
        this.ctx.beginPath();
        this.ctx.arc(this.joystick.baseX, this.joystick.baseY, this.joystick.baseRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw stick
        const stickX = this.joystick.baseX + this.joystick.stickX;
        const stickY = this.joystick.baseY + this.joystick.stickY;
        
        this.ctx.beginPath();
        this.ctx.arc(stickX, stickY, this.joystick.stickRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.joystick.active ? 'rgba(77, 208, 225, 0.8)' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();
        this.ctx.strokeStyle = this.joystick.active ? '#4dd0e1' : 'rgba(255, 255, 255, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    // Render loop
    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw hexagons
        const hexagons = this.getVisibleHexagons();
        for (let hex of hexagons) {
            const key = `${hex.q},${hex.r}`;
            const isActive = this.activeCells.has(key);
            const isOrigin = hex.q === 0 && hex.r === 0;
            this.drawHexagon(hex.x, hex.y, hex.q, hex.r, isActive || isOrigin);
        }
        
        // Draw joystick
        this.drawJoystick();
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the application
const canvas = document.getElementById('canvas');
const hexGrid = new HexGrid(canvas);
