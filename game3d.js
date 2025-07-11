// Game3DLib.js
// ES6 모듈 없이 단일 파일로 작성된 3D 게임 라이브러리 + 확장 기능

// -------------------- Math --------------------
class Vector3 {
  constructor(x=0, y=0, z=0){ this.x=x; this.y=y; this.z=z; }
  add(v){return new Vector3(this.x+v.x, this.y+v.y, this.z+v.z);}
  sub(v){return new Vector3(this.x-v.x, this.y-v.y, this.z-v.z);}
  mul(s){return new Vector3(this.x*s, this.y*s, this.z*s);}
  dot(v){return this.x*v.x + this.y*v.y + this.z*v.z;}
  cross(v){
    return new Vector3(
      this.y*v.z - this.z*v.y,
      this.z*v.x - this.x*v.z,
      this.x*v.y - this.y*v.x
    );
  }
  length(){ return Math.hypot(this.x, this.y, this.z); }
}

class Matrix4 {
  constructor(){ this.m = new Float32Array(16); this.identity(); }
  identity(){
    const m = this.m;
    m.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    return this;
  }
  translate(v){
    this.m[12] += v.x; this.m[13] += v.y; this.m[14] += v.z;
    return this;
  }
  multiply(mat){
    const a = this.m, b = mat.m, r = new Float32Array(16);
    for(let i=0;i<4;i++) for(let j=0;j<4;j++){
      let sum = 0;
      for(let k=0;k<4;k++) sum += a[k*4+i] * b[j*4+k];
      r[j*4+i] = sum;
    }
    this.m = r; return this;
  }
  static perspective(fov, aspect, near, far){
    const m = new Matrix4(), f = 1 / Math.tan(fov*Math.PI/360);
    m.m[0] = f/aspect; m.m[5] = f;
    m.m[10] = (far+near)/(near-far);
    m.m[11] = -1;
    m.m[14] = 2*far*near/(near-far);
    m.m[15] = 0;
    return m;
  }
}

class Quaternion {
  constructor(x=0,y=0,z=0,w=1){ this.x=x; this.y=y; this.z=z; this.w=w; }
  multiply(q){
    const {x,y,z,w} = this;
    return new Quaternion(
      w*q.x + x*q.w + y*q.z - z*q.y,
      w*q.y + y*q.w + z*q.x - x*q.z,
      w*q.z + z*q.w + x*q.y - y*q.x,
      w*q.w - x*q.x - y*q.y - z*q.z
    );
  }
  normalize(){
    const l = Math.hypot(this.x,this.y,this.z,this.w);
    this.x/=l; this.y/=l; this.z/=l; this.w/=l;
    return this;
  }
}

// -------------------- Input --------------------
class InputManager {
  static keys = {};
  static mouse = { x:0, y:0, buttons:{} };
  static init(canvas){
    window.addEventListener('keydown', e=>this.keys[e.code]=true);
    window.addEventListener('keyup',   e=>this.keys[e.code]=false);
    canvas.addEventListener('mousemove', e=>{
      this.mouse.x=e.offsetX; this.mouse.y=e.offsetY;
    });
    canvas.addEventListener('mousedown', e=>this.mouse.buttons[e.button]=true);
    canvas.addEventListener('mouseup',   e=>this.mouse.buttons[e.button]=false);
  }
  static isKeyDown(code){ return !!this.keys[code]; }
  static isMouseDown(btn){ return !!this.mouse.buttons[btn]; }
  static update(){ /* 필요 시 폴링 로직 */ }
}

// -------------------- Core --------------------
class Canvas {
  constructor(id,width=800,height=600){
    this.el = document.getElementById(id);
    this.el.width = width; this.el.height = height;
    this.width = width; this.height = height;
    this.gl = this.el.getContext('webgl2');
    InputManager.init(this.el);
  }
  getContext(){ return this.gl; }
}

class Application {
  constructor(gl, canvas){
    this.gl = gl; this.canvas = canvas;
    this._updateCallbacks = [];
  }
  onUpdate(fn){ this._updateCallbacks.push(fn); }
  run(){
    const loop = ()=>{
      InputManager.update();
      for(const fn of this._updateCallbacks) fn();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// -------------------- Renderer --------------------
class Shader {
  constructor(gl, vsSrc, fsSrc){
    this.gl = gl;
    const compile = (src, type)=>{
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = compile(vsSrc, gl.VERTEX_SHADER);
    const fs = compile(fsSrc, gl.FRAGMENT_SHADER);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      console.error(gl.getProgramInfoLog(this.program));
  }
  bind(){ this.gl.useProgram(this.program); }
  setMat4(name, mat){
    const loc = this.gl.getUniformLocation(this.program, name);
    this.gl.uniformMatrix4fv(loc, false, mat.m);
  }
}

class Mesh {
  constructor(gl, verts, inds){
    this.gl = gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);
    this.indexCount = inds.length;
    gl.bindVertexArray(null);
  }
  bind(){ this.gl.bindVertexArray(this.vao); }
  static createCube(gl){
    const v = [
      -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
      -1,-1,1,  1,-1,1,  1,1,1,  -1,1,1
    ];
    const i = [
      0,1,2, 2,3,0, 4,5,6, 6,7,4,
      0,4,7, 7,3,0, 1,5,6, 6,2,1,
      3,2,6, 6,7,3, 0,1,5, 5,4,0
    ];
    return new Mesh(gl, v, i);
  }
}

class Texture2D {
  constructor(gl, image){
    this.gl = gl;
    this.id = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  bind(unit=0){
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
  }
}

class RenderCommand {
  static clear(color=[0,0,0,1]){
    const gl = RenderCommand.gl;
    gl.clearColor(...color);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  static init(gl){ RenderCommand.gl = gl; }
}

// -------------------- Scene --------------------
class SceneNode {
  constructor(){
    this.children = [];
    this.transform = new Matrix4();
    this.mesh = null;
    this.shader = null;
  }
  add(child){ this.children.push(child); }
  update(dt){ /* 사용자 정의 업데이트 */ }
  draw(camera){
    if(this.mesh && this.shader){
      this.shader.bind();
      this.shader.setMat4('u_viewProj', camera.viewProjMatrix);
      this.mesh.bind();
      RenderCommand.gl.drawElements(
        RenderCommand.gl.TRIANGLES, this.mesh.indexCount, RenderCommand.gl.UNSIGNED_SHORT, 0
      );
    }
    for(const c of this.children) c.draw(camera);
  }
}

class Camera {
  constructor(){
    this.position = new Vector3(0,0,5);
    this.proj = Matrix4.perspective(60,1,0.1,100);
    this.viewProjMatrix = new Matrix4();
    this.updateViewProj();
  }
  setPerspective(fov, aspect, near, far){
    this.proj = Matrix4.perspective(fov, aspect, near, far);
    this.updateViewProj();
  }
  updateViewProj(){
    const t = new Matrix4().identity().translate(
      new Vector3(-this.position.x, -this.position.y, -this.position.z)
    );
    this.viewProjMatrix = this.proj.multiply(t);
  }
}

class Scene {
  constructor(){ this.root = new SceneNode(); this.camera = new Camera(); }
  update(dt){ this.root.update(dt); this.camera.updateViewProj(); }
  render(){ this.root.draw(this.camera); }
}

// -------------------- Physics --------------------
class PhysicsEngine {
  constructor(){ this.bodies = []; }
  addBody(body){ this.bodies.push(body); }
  simulate(dt){
    // 간단한 중력 + Euler integration 예시
    for(const b of this.bodies){
      if(!b.invMass) continue;
      b.velocity.y -= 9.81*dt;
      b.position = b.position.add(b.velocity.mul(dt));
      b.node.transform.identity().translate(b.position);
    }
  }
}

// -------------------- Animation --------------------
class Animator {
  constructor(){ this.clips = []; }
  addClip(clip){ this.clips.push(clip); }
  update(dt){
    // 스켈레탈 애니메이션 업데이트 로직
    for(const clip of this.clips) clip.advance(dt);
  }
}

// -------------------- Scripting --------------------
class ScriptManager {
  constructor(){ this.scripts = []; }
  add(scriptFn){ this.scripts.push(scriptFn); }
  update(dt){
    for(const fn of this.scripts) fn(dt, this);
  }
}

// -------------------- Editor UI (플레이스홀더) --------------------
class EditorUI {
  constructor(containerId){
    this.root = document.getElementById(containerId) || document.body;
    // React/Electron UI 툴킷 통합 가능
  }
  // UI 요소 추가 메소드...
}

// -------------------- Main --------------------
async function main(){
  // 1) 캔버스 + GL 초기화
  const canvas = new Canvas('glCanvas', 800, 600);
  const gl = canvas.getContext();
  gl.enable(gl.DEPTH_TEST);
  RenderCommand.init(gl);

  // 2) 애플리케이션 생성
  const app = new Application(gl, canvas);

  // 3) 셰이더 로드
  const vs = await fetch('vertex.glsl').then(r=>r.text());
  const fs = await fetch('fragment.glsl').then(r=>r.text());
  const shader = new Shader(gl, vs, fs);

  // 4) 메쉬 + 노드 생성
  const cubeMesh = Mesh.createCube(gl);
  const cubeNode = new SceneNode();
  cubeNode.mesh = cubeMesh;
  cubeNode.shader = shader;

  // 5) 씬 구성
  const scene = new Scene();
  scene.root.add(cubeNode);

  // 6) 물리 엔진 설정
  const physics = new PhysicsEngine();
  physics.addBody({ node: cubeNode, position: new Vector3(0,2,0), velocity: new Vector3(0,0,0), invMass:1 });

  // 7) 애니메이터 (예시 스켈레탈) – 실제 스켈레톤 데이터 필요
  const animator = new Animator();
  // animator.addClip(someClip);

  // 8) 스크립트
  const scripts = new ScriptManager();
  scripts.add((dt, mgr)=>{
    if(InputManager.isKeyDown('Space')){
      console.log('Space pressed!');
    }
  });

  // 9) 에디터 UI (플레이스홀더)
  const editor = new EditorUI();

  // 10) 메인 루프 등록
  let last = performance.now();
  app.onUpdate(()=>{
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    InputManager.update();
    physics.simulate(dt);
    animator.update(dt);
    scripts.update(dt);
    scene.update(dt);

    RenderCommand.clear([0.1,0.1,0.1,1]);
    scene.render();
  });

  // 11) 실행
  app.run();
}

// DOMContentLoaded 이후 실행
window.addEventListener('DOMContentLoaded', main);

// index.html 내부 예시:
// <canvas id="glCanvas"></canvas>
// <script src="Game3DLib.js"></script>
```
