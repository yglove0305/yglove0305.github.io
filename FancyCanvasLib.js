export default class FancyCanvasLib {
  constructor(container = document.body, options = {}) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this.width = options.width || window.innerWidth;
    this.height = options.height || window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.shapes = [];
    this.particles = [];
    this.backgroundStars = [];
    this.layers = {};
    this.tweens = [];
    this.eventListeners = {};
    this.stateVersion = 0;
    this.gridSize = options.gridSize || 50;

    this.mouse = { x: 0, y: 0, down: false, dragTarget: null };
    this._paused = false;
    this.apiKey = options.apiKey || null;
    this.bgColor = options.backgroundColor || 'rgba(0,0,0,0.08)';
    this.isFree = false;
    this.freePath = [];

    
    this._initBackgroundStars(options.starCount || 100);
    this._setupEvents();
    requestAnimationFrame(this._animate.bind(this));
  }

 
  static randomColor(alpha = 0.7) {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  static distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  static ease(t) {
    return (--t) * t * t + 1;
  }


  _initBackgroundStars(count) {
    for (let i = 0; i < count; i++) {
      this.backgroundStars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 1.5,
        speed: Math.random() * 0.5 + 0.1,
        alpha: Math.random() * 0.5 + 0.3
      });
    }
  }

  _updateBackgroundStars() {
    this.backgroundStars.forEach(s => {
      s.x -= s.speed;
      if (s.x < 0) s.x = this.width;
    });
  }

  _drawBackgroundStars() {
    const c = this.ctx;
    c.save();
    c.fillStyle = 'white';
    this.backgroundStars.forEach(s => {
      c.globalAlpha = s.alpha;
      c.beginPath();
      c.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      c.fill();
      c.closePath();
    });
    c.restore();
  }

  
  drawGrid() {
    const c = this.ctx;
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let x = 0; x < this.width; x += this.gridSize) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.height); c.stroke();
    }
    for (let y = 0; y < this.height; y += this.gridSize) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(this.width, y); c.stroke();
    }
    c.restore();
  }


  addLayer(name) { if (!this.layers[name]) this.layers[name] = []; }
  removeLayer(name) { delete this.layers[name]; }
  getLayer(name) { return this.layers[name] || null; }


  on(evt, fn) { if (!this.eventListeners[evt]) this.eventListeners[evt] = []; this.eventListeners[evt].push(fn); }
  off(evt, fn) { if (!this.eventListeners[evt]) return; this.eventListeners[evt] = this.eventListeners[evt].filter(f => f !== fn); }
  _emit(evt, data) { (this.eventListeners[evt] || []).forEach(f => f(data)); }


  loadImage(url, cb) { const img = new Image(); img.onload = () => cb(img); img.src = url; }


  snap(x, y) { return [Math.round(x / this.gridSize) * this.gridSize, Math.round(y / this.gridSize) * this.gridSize]; }

  
  exportState() { return JSON.stringify({ shapes: this.shapes.map(s => s.serialize()), layers: this.layers, version: this.stateVersion }); }
  importState(json) {
    const st = JSON.parse(json);
    this.clearShapes();
    st.shapes.forEach(o => this.addShapeFromData(o));
    this.layers = st.layers;
    this.stateVersion = st.version;
    this._emit('stateImported');
  }
  addShapeFromData(data) {
    switch(data.type) {
      case 'circle': return this.addCircle(data.x, data.y, data.r, data.color);
      case 'rect': return this.addRect(data.x, data.y, data.w, data.h, data.color);
      case 'line': return this.addLine(data.x, data.y, data.x2, data.y2, data.color);
    }
  }

 
  _createParticles(x, y, count = 30) {
    for (let i = 0; i < count; i++) { this.particles.push(new FancyCanvasLib.Particle(x, y)); }
  }

  
  tween(obj, prop, to, duration = 1000) {
    const from = obj[prop];
    const start = Date.now();
    this.tweens.push({ obj, prop, from, to, duration, start });
  }
  _updateTweens() {
    const now = Date.now();
    this.tweens = this.tweens.filter(t => {
      const ttime = (now - t.start) / t.duration;
      if (ttime >= 1) {
        t.obj[t.prop] = t.to; return false;
      } else {
        t.obj[t.prop] = FancyCanvasLib.lerp(t.from, t.to, FancyCanvasLib.ease(ttime));
        return true;
      }
    });
  }

 
  addCircle(x, y, r, color) {
    const c = new FancyCanvasLib.Circle(x || Math.random() * this.width,
      y || Math.random() * this.height, r, color);
    this.shapes.push(c);
    this._emit('shapeAdded', c);
    return c;
  }
  addRect(x, y, w, h, color) {
    const r = new FancyCanvasLib.Rect(x || Math.random()*this.width,
      y || Math.random()*this.height, w, h, color);
    this.shapes.push(r);
    this._emit('shapeAdded', r);
    return r;
  }
  addLine(x1, y1, x2, y2, color) {
    const l = new FancyCanvasLib.Line(x1 || Math.random()*this.width,
      y1 || Math.random()*this.height, x2, y2, color);
    this.shapes.push(l);
    this._emit('shapeAdded', l);
    return l;
  }
  removeShape(s) { this.shapes = this.shapes.filter(x => x !== s); this._emit('shapeRemoved', s); }
  clearShapes() { this.shapes = []; this._emit('shapesCleared'); }
  getShapes() { return [...this.shapes]; }

  /* =========== 확장 기능: 이미지 텍스쳐 =========== */
  drawImageTexture(img, x, y, w, h) { this.ctx.drawImage(img, x, y, w||img.width, h||img.height); }

  /* ========= 확장 기능: 텍스트 그리기 ========== */
  drawText(text, x, y, options = { size: '20px', font: 'sans-serif', color: 'white' }) {
    const c = this.ctx;
    c.save(); c.fillStyle = options.color;
    c.font = `${options.size} ${options.font}`;
    c.fillText(text, x, y);
    c.restore();
  }

  /* ========= 확장 기능: Canvas 필터 ========== */
  setFilter(filter) { this.ctx.filter = filter; }
  clearFilter() { this.ctx.filter = 'none'; }

  /* ========= 확장 기능: 마스크 ========== */
  createCircularMask(x,y,r,fnDraw) {
    const c = this.ctx;
    c.save(); c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.clip();
    fnDraw();
    c.restore();
  }

  /* ======== 확장 기능: 프리핸드 드로잉 ======== */
  enableFreehand() { this.isFree = true; this.freePath = []; }
  disableFreehand() { this.isFree = false; this.freePath = []; }
  _drawFreehand() {
    if (this.freePath.length < 2) return;
    const c = this.ctx;
    c.save(); c.strokeStyle = FancyCanvasLib.randomColor(1);
    c.beginPath(); c.moveTo(...this.freePath[0]);
    this.freePath.forEach(pt => c.lineTo(...pt)); c.stroke();
    c.restore();
  }

  /* =============== API 키 관리 ============== */
  setApiKey(key) { this.apiKey = key; this._emit('apiKeyUpdated', key); }
  getApiKey() { return this.apiKey; }

  /* =============== 일시정지/재개 ============== */
  pause() { this._paused = true; }
  resume() {
    if (this._paused) { this._paused = false; requestAnimationFrame(this._animate.bind(this)); }
  }

  /* ========= 상태 Export 이미지 ========= */
  exportAsImage(format = 'png') { return this.canvas.toDataURL(`image/${format}`); }

  /* ========= 메인 루프 ========== */
  _animate() {
    if (this._paused) return;
    const c = this.ctx;
    c.fillStyle = this.bgColor;
