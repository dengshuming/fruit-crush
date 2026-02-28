// 渲染器
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = CONFIG.CELL_SIZE;
    this.cols = CONFIG.COLS;
    this.rows = CONFIG.ROWS;
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;
    this.particles = [];
  }

  draw(board, selected) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * this.cellSize;
        const y = r * this.cellSize;
        const isSelected = selected && selected.r === r && selected.c === c;

        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4, 9);

        if (isSelected) {
          ctx.fillStyle = '#fff9c4';
          ctx.fill();
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#f0eaff' : '#e8f4ff';
          ctx.fill();
          ctx.strokeStyle = 'rgba(180,160,220,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = board.grid[r][c];
        if (!cell) continue;

        const x = c * this.cellSize + this.cellSize / 2;
        const baseY = r * this.cellSize + this.cellSize / 2;
        const y = baseY + (cell.offsetY || 0);
        const scale = cell.scale || 1;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        if (cell.special === CONFIG.SPECIAL.BOMB) {
          ctx.shadowColor = '#ff6600';
          ctx.shadowBlur = 12;
        } else if (cell.special === CONFIG.SPECIAL.RAINBOW) {
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 16;
        }

        ctx.font = `${this.cellSize * 0.72}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (cell.special === CONFIG.SPECIAL.BOMB) {
          ctx.fillText('💣', 0, 0);
        } else if (cell.special === CONFIG.SPECIAL.RAINBOW) {
          ctx.fillText('🌈', 0, 0);
        } else {
          ctx.fillText(CONFIG.FRUITS[cell.type], 0, 0);
        }

        ctx.restore();
      }
    }

    this._drawParticles();
    this._drawHint();
  }

  addParticles(r, c, count = 8) {
    const x = c * this.cellSize + this.cellSize / 2;
    const y = r * this.cellSize + this.cellSize / 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: `hsl(${Math.random() * 360}, 100%, 65%)`,
        size: 4 + Math.random() * 4
      });
    }
  }

  _drawParticles() {
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.03;
    });
  }

  _drawHint() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('点击选中 → 点击相邻交换  /  拖拽交换', w / 2, h - 4);
    ctx.restore();
  }

  _drawGrid(ctx) {
    const cs = this.cellSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        ctx.beginPath();
        ctx.roundRect(c * cs + 2, r * cs + 2, cs - 4, cs - 4, 9);
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0eaff' : '#e8f4ff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(180,160,220,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  _drawAllFruits(board, ctx, overrides) {
    const cs = this.cellSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = board.grid[r][c];
        if (!cell) continue;

        let drawX = c * cs + cs / 2;
        let drawY = r * cs + cs / 2 + (cell.offsetY || 0);

        if (overrides) {
          const key = `${r},${c}`;
          if (overrides[key]) { drawX += overrides[key].dx; drawY += overrides[key].dy; }
        }

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.scale(cell.scale || 1, cell.scale || 1);
        ctx.font = `${cs * 0.72}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (cell.special === CONFIG.SPECIAL.BOMB) ctx.fillText('💣', 0, 0);
        else if (cell.special === CONFIG.SPECIAL.RAINBOW) ctx.fillText('🌈', 0, 0);
        else ctx.fillText(CONFIG.FRUITS[cell.type], 0, 0);
        ctx.restore();
      }
    }
  }

  // 交换动画
  animateSwap(board, r1, c1, r2, c2, onDone) {
    const cs = this.cellSize;
    const dx = (c2 - c1) * cs;
    const dy = (r2 - r1) * cs;
    let progress = 0;
    const duration = 14;

    const step = () => {
      progress++;
      const t = progress / duration;
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._drawGrid(ctx);
      this._drawAllFruits(board, ctx, {
        [`${r1},${c1}`]: { dx: dx * ease, dy: dy * ease },
        [`${r2},${c2}`]: { dx: -dx * ease, dy: -dy * ease }
      });
      this._drawParticles();

      if (progress < duration) requestAnimationFrame(step);
      else onDone();
    };
    requestAnimationFrame(step);
  }

  // 无效交换弹回动画
  animateSwapBack(board, r1, c1, r2, c2, onDone) {
    const cs = this.cellSize;
    const dx = (c2 - c1) * cs;
    const dy = (r2 - r1) * cs;
    let progress = 0;
    const duration = 16;

    const step = () => {
      progress++;
      const t = progress / duration;
      const factor = Math.sin(t * Math.PI) * 0.45;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._drawGrid(ctx);
      this._drawAllFruits(board, ctx, {
        [`${r1},${c1}`]: { dx: dx * factor, dy: dy * factor },
        [`${r2},${c2}`]: { dx: -dx * factor, dy: -dy * factor }
      });
      this._drawParticles();

      if (progress < duration) requestAnimationFrame(step);
      else { this.draw(board, null); onDone(); }
    };
    requestAnimationFrame(step);
  }

  // 下落动画
  animateFall(board, onDone) {
    const speed = 8;
    const step = () => {
      let allDone = true;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = board.grid[r][c];
          if (!cell) continue;
          if (cell.offsetY < 0) {
            cell.offsetY = Math.min(0, cell.offsetY + speed);
            if (cell.offsetY < 0) allDone = false;
          }
          if (cell.scale > 1) cell.scale = Math.max(1, cell.scale - 0.05);
        }
      }
      this.draw(board, null);
      if (!allDone) {
        requestAnimationFrame(step);
      } else {
        // 下落结束后清空粒子，避免残影
        this.particles = [];
        this.draw(board, null);
        onDone();
      }
    };
    requestAnimationFrame(step);
  }

  // 绘制卡通怪物到 #monster-canvas
  drawMonster(lvlIdx) {
    const canvas = document.getElementById('monster-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;

    const styles = [
      // 0: 史莱姆 - 绿色水滴
      () => {
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, 28, 24, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#4cdb6e'; ctx.fill();
        ctx.strokeStyle = '#2a9e47'; ctx.lineWidth = 2; ctx.stroke();
        // 高光
        ctx.beginPath(); ctx.ellipse(cx - 8, cy - 4, 8, 5, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
        // 眼睛
        _eyes(ctx, cx, cy + 2, 5, '#1a1a1a');
        // 嘴
        ctx.beginPath(); ctx.arc(cx, cy + 14, 8, 0.1, Math.PI - 0.1);
        ctx.strokeStyle = '#1a5c2a'; ctx.lineWidth = 2; ctx.stroke();
      },
      // 1: 毒蘑菇 - 红帽白点
      () => {
        // 帽子
        ctx.beginPath(); ctx.ellipse(cx, cy + 4, 28, 20, 0, Math.PI, 0);
        ctx.fillStyle = '#e03030'; ctx.fill();
        ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 2; ctx.stroke();
        // 白点
        [[cx-10,cy-8,5],[cx+10,cy-6,4],[cx,cy-14,6]].forEach(([x,y,r]) => {
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
          ctx.fillStyle='#fff'; ctx.fill();
        });
        // 茎
        ctx.beginPath(); ctx.roundRect(cx-10, cy+4, 20, 18, 4);
        ctx.fillStyle='#f5e6c8'; ctx.fill();
        ctx.strokeStyle='#c8a96e'; ctx.lineWidth=1.5; ctx.stroke();
        _eyes(ctx, cx, cy + 12, 4, '#333');
      },
      // 2: 骷髅兵 - 白色骷髅
      () => {
        ctx.beginPath(); ctx.ellipse(cx, cy, 26, 28, 0, 0, Math.PI*2);
        ctx.fillStyle='#e8e8e8'; ctx.fill();
        ctx.strokeStyle='#999'; ctx.lineWidth=2; ctx.stroke();
        // 眼眶
        [[cx-9,cy-4],[cx+9,cy-4]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.ellipse(x,y,7,8,0,0,Math.PI*2);
          ctx.fillStyle='#222'; ctx.fill();
          ctx.beginPath(); ctx.ellipse(x+2,y-2,2,2,0,0,Math.PI*2);
          ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fill();
        });
        // 鼻孔
        ctx.beginPath(); ctx.ellipse(cx,cy+6,3,4,0,0,Math.PI*2);
        ctx.fillStyle='#bbb'; ctx.fill();
        // 牙齿
        for(let i=-1;i<=1;i++){
          ctx.beginPath(); ctx.rect(cx+i*7-3,cy+16,6,8);
          ctx.fillStyle='#fff'; ctx.fill();
          ctx.strokeStyle='#aaa'; ctx.lineWidth=1; ctx.stroke();
        }
      },
      // 3: 火焰魔 - 橙红色
      () => {
        // 火焰身体
        ctx.beginPath();
        ctx.moveTo(cx, cy-30);
        ctx.bezierCurveTo(cx+20,cy-20, cx+30,cy, cx+20,cy+20);
        ctx.bezierCurveTo(cx+10,cy+30, cx-10,cy+30, cx-20,cy+20);
        ctx.bezierCurveTo(cx-30,cy, cx-20,cy-20, cx,cy-30);
        const grad = ctx.createRadialGradient(cx,cy,4,cx,cy,30);
        grad.addColorStop(0,'#fff176'); grad.addColorStop(0.5,'#ff6d00'); grad.addColorStop(1,'#b71c1c');
        ctx.fillStyle=grad; ctx.fill();
        // 眼睛（白色发光）
        [[cx-9,cy-2],[cx+9,cy-2]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2);
          ctx.fillStyle='#fff'; ctx.fill();
          ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2);
          ctx.fillStyle='#ff1744'; ctx.fill();
        });
        // 嘴
        ctx.beginPath(); ctx.arc(cx,cy+10,8,0,Math.PI);
        ctx.fillStyle='#b71c1c'; ctx.fill();
      },
      // 4: 冰霜巨人 - 蓝白
      () => {
        ctx.beginPath(); ctx.ellipse(cx,cy+2,28,30,0,0,Math.PI*2);
        const g=ctx.createRadialGradient(cx-8,cy-8,2,cx,cy,30);
        g.addColorStop(0,'#e3f2fd'); g.addColorStop(1,'#1565c0');
        ctx.fillStyle=g; ctx.fill();
        ctx.strokeStyle='#90caf9'; ctx.lineWidth=2; ctx.stroke();
        // 冰晶纹路
        ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1;
        [[cx,cy-20,cx,cy+10],[cx-20,cy,cx+20,cy],[cx-14,cy-14,cx+14,cy+14],[cx+14,cy-14,cx-14,cy+14]].forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });
        _eyes(ctx,cx,cy,6,'#0d47a1');
        // 眉毛
        ctx.beginPath(); ctx.moveTo(cx-16,cy-14); ctx.lineTo(cx-6,cy-10);
        ctx.moveTo(cx+6,cy-10); ctx.lineTo(cx+16,cy-14);
        ctx.strokeStyle='#1565c0'; ctx.lineWidth=2.5; ctx.stroke();
      },
      // 5: 毒蛙王 - 绿色青蛙
      () => {
        ctx.beginPath(); ctx.ellipse(cx,cy+4,28,24,0,0,Math.PI*2);
        ctx.fillStyle='#66bb6a'; ctx.fill();
        ctx.strokeStyle='#2e7d32'; ctx.lineWidth=2; ctx.stroke();
        // 大眼睛（凸出）
        [[cx-12,cy-14],[cx+12,cy-14]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2);
          ctx.fillStyle='#a5d6a7'; ctx.fill();
          ctx.strokeStyle='#2e7d32'; ctx.lineWidth=1.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2);
          ctx.fillStyle='#1b5e20'; ctx.fill();
          ctx.beginPath(); ctx.arc(x+2,y-2,2,0,Math.PI*2);
          ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();
        });
        // 嘴
        ctx.beginPath(); ctx.arc(cx,cy+12,14,0,Math.PI);
        ctx.fillStyle='#ef9a9a'; ctx.fill();
        ctx.strokeStyle='#2e7d32'; ctx.lineWidth=1.5; ctx.stroke();
        // 毒点
        ctx.fillStyle='#cddc39';
        [[cx-18,cy+2],[cx+18,cy+2],[cx,cy+22]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
        });
      },
      // 6: 雷电魔法师 - 紫色
      () => {
        ctx.beginPath(); ctx.ellipse(cx,cy,26,28,0,0,Math.PI*2);
        const g=ctx.createRadialGradient(cx,cy,4,cx,cy,28);
        g.addColorStop(0,'#ce93d8'); g.addColorStop(1,'#4a148c');
        ctx.fillStyle=g; ctx.fill();
        ctx.strokeStyle='#e040fb'; ctx.lineWidth=2; ctx.stroke();
        // 闪电眼
        [[cx-9,cy-4],[cx+9,cy-4]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2);
          ctx.fillStyle='#fff9c4'; ctx.fill();
          ctx.font='10px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('⚡',x,y);
        });
        // 帽子
        ctx.beginPath(); ctx.moveTo(cx,cy-42); ctx.lineTo(cx-18,cy-28); ctx.lineTo(cx+18,cy-28); ctx.closePath();
        ctx.fillStyle='#4a148c'; ctx.fill();
        ctx.strokeStyle='#e040fb'; ctx.lineWidth=1.5; ctx.stroke();
        // 嘴
        ctx.beginPath(); ctx.arc(cx,cy+10,7,0.2,Math.PI-0.2);
        ctx.strokeStyle='#e040fb'; ctx.lineWidth=2; ctx.stroke();
      },
      // 7: 吸血鬼伯爵 - 深色
      () => {
        // 披风
        ctx.beginPath(); ctx.moveTo(cx-28,cy+32); ctx.lineTo(cx-20,cy); ctx.lineTo(cx+20,cy); ctx.lineTo(cx+28,cy+32); ctx.closePath();
        ctx.fillStyle='#1a0030'; ctx.fill();
        // 脸
        ctx.beginPath(); ctx.ellipse(cx,cy-4,22,24,0,0,Math.PI*2);
        ctx.fillStyle='#e8d5c4'; ctx.fill();
        ctx.strokeStyle='#5d0000'; ctx.lineWidth=1.5; ctx.stroke();
        // 眼睛
        [[cx-8,cy-8],[cx+8,cy-8]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.ellipse(x,y,5,6,0,0,Math.PI*2);
          ctx.fillStyle='#b71c1c'; ctx.fill();
          ctx.beginPath(); ctx.arc(x+1,y-2,1.5,0,Math.PI*2);
          ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill();
        });
        // 牙齿
        ctx.beginPath(); ctx.moveTo(cx-6,cy+8); ctx.lineTo(cx-4,cy+16); ctx.lineTo(cx-2,cy+8);
        ctx.moveTo(cx+2,cy+8); ctx.lineTo(cx+4,cy+16); ctx.lineTo(cx+6,cy+8);
        ctx.fillStyle='#fff'; ctx.fill();
        // 头发
        ctx.beginPath(); ctx.moveTo(cx-22,cy-16); ctx.bezierCurveTo(cx-18,cy-32,cx-6,cy-30,cx,cy-28);
        ctx.bezierCurveTo(cx+6,cy-30,cx+18,cy-32,cx+22,cy-16);
        ctx.fillStyle='#1a0030'; ctx.fill();
      },
      // 8: 终极魔王 - 红黑
      () => {
        // 光环
        ctx.beginPath(); ctx.arc(cx,cy,36,0,Math.PI*2);
        const g=ctx.createRadialGradient(cx,cy,20,cx,cy,36);
        g.addColorStop(0,'transparent'); g.addColorStop(1,'rgba(255,0,0,0.3)');
        ctx.fillStyle=g; ctx.fill();
        // 身体
        ctx.beginPath(); ctx.ellipse(cx,cy+2,26,28,0,0,Math.PI*2);
        const g2=ctx.createRadialGradient(cx-6,cy-6,2,cx,cy,28);
        g2.addColorStop(0,'#b71c1c'); g2.addColorStop(1,'#1a0000');
        ctx.fillStyle=g2; ctx.fill();
        ctx.strokeStyle='#ff1744'; ctx.lineWidth=2; ctx.stroke();
        // 角
        [[cx-16,cy-24,-0.4],[cx+16,cy-24,0.4]].forEach(([x,y,rot])=>{
          ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-6,-18); ctx.lineTo(6,-18); ctx.closePath();
          ctx.fillStyle='#ff1744'; ctx.fill(); ctx.restore();
        });
        // 眼睛
        [[cx-9,cy-4],[cx+9,cy-4]].forEach(([x,y])=>{
          ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2);
          ctx.fillStyle='#ff6d00'; ctx.fill();
          ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2);
          ctx.fillStyle='#fff'; ctx.fill();
          ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2);
          ctx.fillStyle='#000'; ctx.fill();
        });
        // 嘴（锯齿）
        ctx.beginPath(); ctx.moveTo(cx-12,cy+12);
        for(let i=0;i<=6;i++) ctx.lineTo(cx-12+i*4, cy+12+(i%2===0?6:0));
        ctx.strokeStyle='#ff1744'; ctx.lineWidth=2; ctx.stroke();
      }
    ];

    function _eyes(ctx, cx, cy, r, color) {
      [[cx-r*1.8, cy],[cx+r*1.8, cy]].forEach(([x,y])=>{
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fillStyle='#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(x+r*0.3,y,r*0.55,0,Math.PI*2);
        ctx.fillStyle=color; ctx.fill();
      });
    }

    const idx = Math.min(lvlIdx, styles.length - 1);
    styles[idx]();
  }
}
