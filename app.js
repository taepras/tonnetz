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
        this.baseHexSize = 50;
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
            baseX: 70,
            baseY: window.innerHeight - 100,
            baseRadius: 50,
            stickRadius: 20,
            stickX: 0,
            stickY: 0,
            active: false,
            touchId: null,
            maxDistance: 40,
            stickElement: null,
            baseElement: null
        };
        
        // Sound type: 'violin' or 'sine'
        this.soundType = 'violin';
        
        this.init();
    }
    
    init() {
        this.resize();
        this.initJoystick();
        this.setupEventListeners();
        this.animate();
    }
    
    initJoystick() {
        this.joystick.stickElement = document.getElementById('joystick-stick');
        this.joystick.baseElement = document.getElementById('joystick-base');
        this.joystick.container = document.getElementById('joystick-container');
        
        // Add event listeners to joystick
        if (this.joystick.baseElement) {
            this.joystick.baseElement.addEventListener('touchstart', (e) => this.handleJoystickTouchStart(e), { passive: false });
            this.joystick.baseElement.addEventListener('touchmove', (e) => this.handleJoystickTouchMove(e), { passive: false });
            this.joystick.baseElement.addEventListener('touchend', (e) => this.handleJoystickTouchEnd(e), { passive: false });
        }
    }
    
    handleJoystickTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.joystick.active = true;
            this.joystick.touchId = touch.identifier;
            
            const rect = this.joystick.baseElement.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.joystick.maxDistance) {
                const angle = Math.atan2(dy, dx);
                this.joystick.stickX = Math.cos(angle) * this.joystick.maxDistance;
                this.joystick.stickY = Math.sin(angle) * this.joystick.maxDistance;
            } else {
                this.joystick.stickX = dx;
                this.joystick.stickY = dy;
            }
            
            this.updateJoystickVisual();
        }
    }
    
    handleJoystickTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.joystick.active) return;
        
        for (let touch of e.touches) {
            if (touch.identifier === this.joystick.touchId) {
                const rect = this.joystick.baseElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const dx = touch.clientX - centerX;
                const dy = touch.clientY - centerY;
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
                this.camera.x -= (this.joystick.stickX / this.joystick.maxDistance) * panSpeed;
                this.camera.y -= (this.joystick.stickY / this.joystick.maxDistance) * panSpeed;
                
                this.updateJoystickVisual();
                break;
            }
        }
    }
    
    handleJoystickTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.stickX = 0;
        this.joystick.stickY = 0;
        this.updateJoystickVisual();
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
        const dpr = window.devicePixelRatio || 1;
        
        // Get CSS dimensions
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Set canvas internal resolution to match device pixel ratio
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        
        // Scale context to account for device pixel ratio
        this.ctx.scale(dpr, dpr);
        
        // Update joystick position
        this.joystick.baseY = this.height - 100;
        if (this.joystick.container) {
            this.joystick.container.style.bottom = '100px';
        }
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
        
        // Zoom button events
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
            zoomInBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.zoomIn();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
            zoomOutBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.zoomOut();
            });
        }
        
        // Sound toggle button events
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.toggleSound());
            soundToggle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleSound();
            });
        }
    }
    
    toggleSound() {
        this.soundType = this.soundType === 'violin' ? 'sine' : 'violin';
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            if (this.soundType === 'violin') {
                soundToggle.textContent = '🎻';
                soundToggle.classList.add('active');
            } else {
                soundToggle.textContent = '~';
                soundToggle.classList.remove('active');
            }
        }
    }
    
    zoomIn() {
        const newZoom = Math.min(5, this.camera.zoom * 1.2);
        this.camera.zoom = newZoom;
    }
    
    zoomOut() {
        const newZoom = Math.max(0.5, this.camera.zoom * 0.8);
        this.camera.zoom = newZoom;
    }
    
    // Hexagon math (flat-top orientation)
    axialToPixel(q, r) {
        // Swapped q and r, and negated q in y to reverse directions (northeast = +q = 5/4)
        const x = this.baseHexSize * (Math.sqrt(3) * r + Math.sqrt(3) / 2 * q);
        const y = this.baseHexSize * (3 / 2 * -q);
        return { x, y };
    }
    
    pixelToAxial(x, y) {
        // Proper inverse: solve for q and r from the axialToPixel equations
        // x = baseHexSize * (sqrt(3) * r + sqrt(3)/2 * q)
        // y = baseHexSize * (3/2 * -q)
        // From second equation: q = -2y / (3 * baseHexSize)
        // Substitute into first and solve for r:
        // x = baseHexSize * (sqrt(3) * r + sqrt(3)/2 * q)
        // x / baseHexSize = sqrt(3) * r + sqrt(3)/2 * q
        // r = (x / baseHexSize - sqrt(3)/2 * q) / sqrt(3)
        // r = x / (sqrt(3) * baseHexSize) - q/2
        const q = (-2 / 3 * y) / this.baseHexSize;
        const r = (x / (Math.sqrt(3) * this.baseHexSize)) - (q / 2);
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
        } else if (highlight && !(q === 0 && r === 0)) {
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
            this.ctx.fill();
        }
        
        // Stroke
        if (q === 0 && r === 0) {
            // Yellow outline for origin
            this.ctx.strokeStyle = '#ffeb3b';
            this.ctx.lineWidth = 3;
        } else if (highlight) {
            this.ctx.strokeStyle = '#4dd0e1';
            this.ctx.lineWidth = 2;
        } else {
            this.ctx.strokeStyle = '#2a2a4e';
            this.ctx.lineWidth = 2;
        }
        this.ctx.stroke();
        
        // Draw text labels
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.floor(12 * this.camera.zoom)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        // this.ctx.fillText(`${q},${r}`, x, y);

        // Swapped to match new direction: q uses 5/4, r uses 3/2
        const qFreq = Math.pow(1.25, q);
        const rFreq = Math.pow(1.5, Math.ceil(r / 2)) * Math.pow(0.75, Math.floor(r / 2));

        const numerator = (q > 0 ? Math.pow(5, q) : Math.pow(4, -q)) * (r > 0 ? Math.pow(3, r) : Math.pow(2, Math.ceil(Math.abs(r) / 2) * 3 - (Math.abs(r) % 2 === 1 ? 1 : 0)));
        const denominator = (q > 0 ? Math.pow(4, q) : Math.pow(5, -q)) * (r > 0 ? Math.pow(2, Math.ceil(r / 2) * 3 - (r % 2 === 1 ? 2 : 0)) : Math.pow(3, -r));
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
        
        // Convert corners to axial coordinates to find range
        const topLeftHex = this.pixelToAxial(topLeft.x, topLeft.y);
        const bottomRightHex = this.pixelToAxial(bottomRight.x, bottomRight.y);
        const topRightHex = this.pixelToAxial(bottomRight.x, topLeft.y);
        const bottomLeftHex = this.pixelToAxial(topLeft.x, bottomRight.y);
        
        // Find min/max with extra margin
        const margin = 3;
        const minQ = Math.min(topLeftHex.q, bottomRightHex.q, topRightHex.q, bottomLeftHex.q) - margin;
        const maxQ = Math.max(topLeftHex.q, bottomRightHex.q, topRightHex.q, bottomLeftHex.q) + margin;
        const minR = Math.min(topLeftHex.r, bottomRightHex.r, topRightHex.r, bottomLeftHex.r) - margin;
        const maxR = Math.max(topLeftHex.r, bottomRightHex.r, topRightHex.r, bottomLeftHex.r) + margin;
        
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
        this.currentMouseHex = hex;
        this.playTone(hex.q, hex.r);
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            if (this.enablePanZoom) {
                const dx = e.clientX - this.lastMousePos.x;
                const dy = e.clientY - this.lastMousePos.y;
                
                this.camera.x += dx / this.camera.zoom;
                this.camera.y += dy / this.camera.zoom;
                
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            } else {
                // Check if moved to different hex
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                const currentHex = this.pixelToAxial(worldPos.x, worldPos.y);
                const currentKey = `${currentHex.q},${currentHex.r}`;
                const lastKey = `${this.currentMouseHex.q},${this.currentMouseHex.r}`;
                
                if (currentKey !== lastKey) {
                    this.stopTone(lastKey);
                    this.playTone(currentHex.q, currentHex.r);
                    this.currentMouseHex = currentHex;
                }
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.currentMouseHex) {
            const key = `${this.currentMouseHex.q},${this.currentMouseHex.r}`;
            this.stopTone(key);
            this.currentMouseHex = null;
        }
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
        
        // Handle tile sliding for non-joystick touches
        for (let touch of e.touches) {
            const lastTouch = this.touches.get(touch.identifier);
            if (lastTouch) {
                const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
                const currentHex = this.pixelToAxial(worldPos.x, worldPos.y);
                const currentKey = `${currentHex.q},${currentHex.r}`;
                const lastKey = `${lastTouch.hex.q},${lastTouch.hex.r}`;
                
                // If moved to a different hex, stop old sound and play new one
                if (currentKey !== lastKey) {
                    this.stopTone(lastKey);
                    this.playTone(currentHex.q, currentHex.r);
                    
                    // Update touch data with new hex
                    this.touches.set(touch.identifier, {
                        x: touch.clientX,
                        y: touch.clientY,
                        hex: currentHex
                    });
                } else if (this.enablePanZoom) {
                    // Pan if in same hex
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
            }
        }
        
        if (e.touches.length === 2 && this.enablePanZoom) {
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
        const baseFreq = 261.625565; // Middle C (C4)
        // q (northeast) uses 1.25 (5/4)
        // r (horizontal) alternates between 3/2 and 3/4
        const qFreq = Math.pow(1.25, q);
        const rFreq = Math.pow(1.5, Math.ceil(r / 2)) * Math.pow(0.75, Math.floor(r / 2));
        const frequency = baseFreq * qFreq * rFreq;
        
        // Create gain node for overall control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        const oscillators = [];
        
        if (this.soundType === 'violin') {
            // Violin-like harmonics
            gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.01);
            
            const harmonics = [
                { ratio: 1, gain: 1.0 },      // Fundamental
                { ratio: 2, gain: 0.5 },      // 2nd harmonic (octave)
                { ratio: 3, gain: 0.3 },      // 3rd harmonic (perfect fifth above octave)
                { ratio: 4, gain: 0.25 },     // 4th harmonic (two octaves)
                { ratio: 5, gain: 0.15 },     // 5th harmonic
                { ratio: 6, gain: 0.1 },      // 6th harmonic
                { ratio: 7, gain: 0.05 }      // 7th harmonic
            ];
            
            harmonics.forEach(harmonic => {
                const osc = this.audioContext.createOscillator();
                const harmonicGain = this.audioContext.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(frequency * harmonic.ratio, this.audioContext.currentTime);
                harmonicGain.gain.setValueAtTime(harmonic.gain, this.audioContext.currentTime);
                
                osc.connect(harmonicGain);
                harmonicGain.connect(gainNode);
                
                osc.start();
                oscillators.push(osc);
            });
        } else {
            // Simple sine wave
            gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.01);
            
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            osc.connect(gainNode);
            osc.start();
            oscillators.push(osc);
        }
        
        gainNode.connect(this.audioContext.destination);
        
        // Store active oscillators
        this.activeCells.set(key, { oscillators, gainNode });
        
        // Set color for visual feedback
        const hue = (q * 30 + r * 50) % 360;
        this.cellColors.set(key, `hsla(${hue}, 70%, 50%, 0.5)`);
    }
    
    stopTone(key) {
        const cell = this.activeCells.get(key);
        if (cell) {
            const { oscillators, gainNode } = cell;
            const currentTime = this.audioContext.currentTime;
            
            gainNode.gain.cancelScheduledValues(currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.1);
            
            oscillators.forEach(osc => osc.stop(currentTime + 0.1));
            this.activeCells.delete(key);
            
            // Fade out color
            setTimeout(() => {
                this.cellColors.delete(key);
            }, 100);
        }
    }
    
    // Update joystick visual position
    updateJoystickVisual() {
        if (this.joystick.stickElement) {
            const x = this.joystick.stickX;
            const y = this.joystick.stickY;
            this.joystick.stickElement.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
            
            if (this.joystick.active) {
                this.joystick.stickElement.classList.add('active');
            } else {
                this.joystick.stickElement.classList.remove('active');
            }
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
            const isOrigin = hex.q === 0 && hex.r === 0;
            this.drawHexagon(hex.x, hex.y, hex.q, hex.r, isActive || isOrigin);
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the application
const canvas = document.getElementById('canvas');
const hexGrid = new HexGrid(canvas);
