// 音效系统（Web Audio API）
const SFX = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const play = (freq, type = 'sine', duration = 0.12, gain = 0.18) => {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ac.currentTime + duration);
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.start(); osc.stop(ac.currentTime + duration);
    } catch(e) {}
  };

  // 5种水果对应不同音调
  const fruitFreqs = [523, 587, 659, 784, 880]; // C5 D5 E5 G5 A5

  return {
    match(fruitType, combo) {
      const base = fruitFreqs[fruitType % fruitFreqs.length];
      const comboBoost = 1 + (combo - 1) * 0.12;
      play(base * comboBoost, 'triangle', 0.15, 0.2);
    },
    combo(n) {
      // 连击音：音调递增的和弦
      const notes = [523, 659, 784, 1047, 1319];
      const freq = notes[Math.min(n - 2, notes.length - 1)];
      play(freq, 'square', 0.1, 0.15);
      setTimeout(() => play(freq * 1.5, 'sine', 0.1, 0.1), 60);
    },
    special() {
      play(1047, 'sawtooth', 0.2, 0.25);
      setTimeout(() => play(1319, 'sine', 0.2, 0.2), 80);
      setTimeout(() => play(1568, 'sine', 0.15, 0.15), 160);
    },
    invalid() { play(200, 'square', 0.08, 0.1); },
    levelClear() {
      [523,659,784,1047].forEach((f,i) => setTimeout(() => play(f,'sine',0.2,0.25), i*80));
    },
    gameOver() { play(220, 'sawtooth', 0.4, 0.2); }
  };
})();

// 主游戏逻辑
class Game {
  constructor() {
    this.board = new Board();
    this.renderer = new Renderer(document.getElementById('game-canvas'));
    this.currentLevel = 0;
    this.score = 0;
    this.combo = 0;
    this.timeLeft = 0;
    this.paused = false;
    this.busy = false;
    this.monsterHp = 0;
    this.monsterMaxHp = 0;
    this.timerInterval = null;

    this._bindUI();
    this._showHome();
  }

  // ── 首页 ──────────────────────────────────────
  _showHome() {
    clearInterval(this.timerInterval);
    document.getElementById('home-screen').classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');
    this._renderLeaderboard();
  }

  _hideHome() {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
  }

  _renderLeaderboard() {
    const scores = this._loadScores();
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    if (scores.length === 0) {
      list.innerHTML = '<li class="empty">暂无记录，快去挑战吧！</li>';
      return;
    }
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    scores.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="rank">${medals[i]}</span>
        <span>第${s.level}关 · ${s.name}</span>
        <span class="lb-score">${s.score}</span>
      `;
      list.appendChild(li);
    });
  }

  _loadScores() {
    try { return JSON.parse(localStorage.getItem('fruitCrushScores') || '[]'); }
    catch { return []; }
  }

  _saveScore(score, level, name) {
    const scores = this._loadScores();
    scores.push({ score, level, name });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(5);
    localStorage.setItem('fruitCrushScores', JSON.stringify(scores));
  }

  _bindUI() {
    const canvas = document.getElementById('game-canvas');
    let dragStart = null;

    canvas.addEventListener('mousedown', e => {
      const pos = this._canvasPos(e);
      dragStart = pos;
    });

    canvas.addEventListener('mouseup', e => {
      if (!dragStart || this.busy || this.paused) return;
      const pos = this._canvasPos(e);
      if (dragStart.r === pos.r && dragStart.c === pos.c) {
        this._handleTap(pos.r, pos.c);
      } else if (this.board.isAdjacent(dragStart.r, dragStart.c, pos.r, pos.c)) {
        this._handleSwap(dragStart.r, dragStart.c, pos.r, pos.c);
      }
      dragStart = null;
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const pos = this._canvasPos(e.touches[0]);
      dragStart = pos;
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!dragStart || this.busy || this.paused) return;
      const pos = this._canvasPos(e.changedTouches[0]);
      if (dragStart.r === pos.r && dragStart.c === pos.c) {
        this._handleTap(pos.r, pos.c);
      } else if (this.board.isAdjacent(dragStart.r, dragStart.c, pos.r, pos.c)) {
        this._handleSwap(dragStart.r, dragStart.c, pos.r, pos.c);
      }
      dragStart = null;
    }, { passive: false });

    document.getElementById('btn-restart').addEventListener('click', () => this._startLevel(this.currentLevel));
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('overlay-btn').addEventListener('click', () => this._overlayAction());
    document.getElementById('btn-home').addEventListener('click', () => {
      clearInterval(this.timerInterval);
      this._hideOverlay();
      this._showHome();
    });

    // 首页按钮
    document.getElementById('btn-quick-play').addEventListener('click', () => {
      this._hideHome();
      this._startLevel(0);
    });
    document.getElementById('btn-how-to-play').addEventListener('click', () => {
      document.getElementById('how-to-overlay').classList.remove('hidden');
    });
    document.getElementById('btn-how-to-close').addEventListener('click', () => {
      document.getElementById('how-to-overlay').classList.add('hidden');
    });
  }

  _canvasPos(e) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return {
      r: Math.floor(y / CONFIG.CELL_SIZE),
      c: Math.floor(x / CONFIG.CELL_SIZE)
    };
  }

  _startLevel(idx) {
    clearInterval(this.timerInterval);
    this.currentLevel = idx;
    const lvl = CONFIG.LEVELS[idx];
    this.score = 0;
    this.combo = 0;
    this.paused = false;
    this.busy = false;
    this._overlayNextAction = null;
    this.monsterMaxHp = lvl.monsterHp;
    this.monsterHp = lvl.monsterHp;

    this.board.init();

    // UI
    document.getElementById('level-num').textContent = lvl.level;
    document.getElementById('score-num').textContent = 0;
    document.getElementById('goal-text').textContent = lvl.goalText;
    document.getElementById('monster-name').textContent = lvl.monsterName;
    document.getElementById('btn-pause').textContent = '暂停';
    this._updateMonsterHp();
    this._setBackground(lvl.bg);
    this._hideOverlay();
    this.renderer.drawMonster(idx);

    this.timeLeft = lvl.timeLimit;
    this._updateTimer();

    this.renderer.draw(this.board, null);
    const guideText = lvl.level === 1
      ? lvl.story + '\n\n💡 操作：点击水果选中，再点击相邻水果交换\n也可以直接拖拽交换位置'
      : lvl.story;
    this._showOverlay('⚔️ 第 ' + lvl.level + ' 关', guideText, '开始战斗！');
    // 点击"开始战斗"后再启动计时器
    this._overlayNextAction = () => {
      this.timerInterval = setInterval(() => this._tick(), 1000);
    };
  }

  _tick() {
    if (this.paused || this.busy) return;
    this.timeLeft--;
    this._updateTimer();
    if (this.timeLeft <= 0) {
      clearInterval(this.timerInterval);
      this._gameOver();
    }
  }

  _updateTimer() {
    const el = document.getElementById('timer');
    el.textContent = this.timeLeft;
    const display = document.getElementById('timer-display');
    if (this.timeLeft <= 10) display.classList.add('urgent');
    else display.classList.remove('urgent');
  }

  _handleTap(r, c) {
    if (this.board.selected) {
      const s = this.board.selected;
      if (s.r === r && s.c === c) {
        this.board.selected = null;
        this.renderer.draw(this.board, null);
      } else if (this.board.isAdjacent(s.r, s.c, r, c)) {
        this._handleSwap(s.r, s.c, r, c);
      } else {
        this.board.selected = { r, c };
        this.renderer.draw(this.board, this.board.selected);
      }
    } else {
      this.board.selected = { r, c };
      this.renderer.draw(this.board, this.board.selected);
    }
  }

  _handleSwap(r1, c1, r2, c2) {
    this.board.selected = null;
    this.busy = true;

    // 先播放交换动画
    this.renderer.animateSwap(this.board, r1, c1, r2, c2, () => {
      const result = this.board.trySwap(r1, c1, r2, c2);
      if (!result) {
        // 无效：弹回动画
        this.renderer.animateSwapBack(this.board, r1, c1, r2, c2, () => {
          SFX.invalid();
          this.busy = false;
          this.renderer.draw(this.board, null);
        });
        return;
      }

      this.combo = 0;

      // 彩虹触发
      if (result.special === 'RAINBOW_TRIGGER') {
        SFX.special();
        const res = this.board.resolveRainbow(result.targetType);
        res.matches.forEach(m => this.renderer.addParticles(m.r, m.c, 8));
        this.combo = 1;
        this._applyResult(res.count);
        this.renderer.animateFall(this.board, () => this._checkWinOrChain());
        return;
      }

      // 双炸弹触发
      if (result.special === 'DOUBLE_BOMB') {
        SFX.special();
        const res = this.board.resolveDoubleBomb(result.r, result.c);
        res.matches.forEach(m => this.renderer.addParticles(m.r, m.c, 8));
        this.combo = 1;
        this._applyResult(res.count);
        this.renderer.animateFall(this.board, () => this._checkWinOrChain());
        return;
      }

      this._resolveChain();
    });
  }

  // 应用得分和伤害（不含连击递增，combo 已在外部设好）
  _applyResult(count) {
    const comboMult = CONFIG.COMBO_DAMAGE[Math.min(this.combo - 1, CONFIG.COMBO_DAMAGE.length - 1)];
    const gained = Math.floor(count * 10 * comboMult);
    this.score += gained;
    document.getElementById('score-num').textContent = this.score;
    if (this.combo >= 2) {
      SFX.combo(this.combo);
      const el = document.getElementById('combo-display');
      el.textContent = `${this.combo} 连击！`;
      el.style.opacity = '1';
      clearTimeout(this._comboTimer);
      this._comboTimer = setTimeout(() => { el.style.opacity = '0'; }, 800);
    }
    const dmg = Math.floor(count * comboMult);
    this._damageMonster(dmg, this.combo);
  }

  _checkWinOrChain() {
    if (this.score >= CONFIG.LEVELS[this.currentLevel].targetScore || this.monsterHp <= 0) {
      this._levelClear();
      return;
    }
    setTimeout(() => this._resolveChain(), 100);
  }

  _resolveChain() {
    const result = this.board.resolveMatches();
    if (!result) {
      this.combo = 0;
      this.busy = false;
      this.renderer.draw(this.board, null);
      if (!this.board._hasValidMoves()) this._reshuffleBoard();
      return;
    }

    this.combo++;
    // 消除音效：取第一个匹配格的水果类型
    const firstCell = this.board.grid[result.matches[0].r]?.[result.matches[0].c];
    SFX.match(firstCell ? firstCell.type : 0, this.combo);

    this._applyResult(result.count);
    result.matches.forEach(m => this.renderer.addParticles(m.r, m.c, 6));

    this.renderer.animateFall(this.board, () => this._checkWinOrChain());
  }

  _damageMonster(dmg, combo) {
    this.monsterHp = Math.max(0, this.monsterHp - dmg);
    this._updateMonsterHp();

    const monster = document.getElementById('monster-canvas');
    monster.style.transition = 'none';

    if (combo >= 3) {
      monster.style.transform = 'scale(1.3) rotate(15deg)';
      monster.style.filter = 'drop-shadow(0 0 20px red) brightness(2)';
      setTimeout(() => {
        monster.style.transition = 'transform 0.3s, filter 0.3s';
        monster.style.transform = 'scale(1) rotate(0deg)';
        monster.style.filter = 'drop-shadow(0 0 10px rgba(255,0,0,0.5))';
      }, 150);
    } else {
      monster.style.transform = 'translateX(8px)';
      setTimeout(() => {
        monster.style.transition = 'transform 0.2s';
        monster.style.transform = 'translateX(0)';
      }, 80);
    }
  }

  _updateMonsterHp() {
    const pct = this.monsterHp / this.monsterMaxHp * 100;
    document.getElementById('monster-hp-fill').style.width = pct + '%';
    document.getElementById('monster-hp-text').textContent = `${this.monsterHp} / ${this.monsterMaxHp}`;
  }

  _setBackground(bg) {
    document.getElementById('background').style.background = bg;
  }

  _levelClear() {
    clearInterval(this.timerInterval);
    this.busy = true;
    SFX.levelClear();

    // 怪物死亡动画
    const monster = document.getElementById('monster-canvas');
    monster.style.transition = 'transform 0.5s, opacity 0.5s';
    monster.style.transform = 'scale(0) rotate(360deg)';
    monster.style.opacity = '0';

    setTimeout(() => {
      monster.style.transition = '';
      monster.style.transform = '';
      monster.style.opacity = '';

      // 播放过关星星动画
      this._playClearAnimation(() => {
        if (this.currentLevel >= CONFIG.LEVELS.length - 1) {
          this._playPrincessScene(() => this._gameWin());
        } else {
          const lvlName = CONFIG.LEVELS[this.currentLevel].monsterName;
          const nextLvl = this.currentLevel + 1;
          this._showOverlayWithChoices(
            '🎉 关卡通过！',
            `击败了 ${lvlName}！\n得分：${this.score}`,
            nextLvl
          );
        }
      });
    }, 600);
  }

  _playClearAnimation(onDone) {
    const container = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'clear-anim';
    el.style.cssText = `
      position:absolute;inset:0;z-index:90;pointer-events:none;
      display:flex;flex-direction:column;justify-content:center;align-items:center;
    `;

    // 星星粒子
    const stars = ['⭐','🌟','✨','💫'];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.textContent = stars[i % stars.length];
      const angle = (i / 18) * 360;
      const dist = 80 + Math.random() * 80;
      s.style.cssText = `
        position:absolute;font-size:${18 + Math.random()*16}px;
        top:50%;left:50%;
        transform:translate(-50%,-50%);
        animation:starFly 0.9s ease-out forwards;
        --dx:${Math.cos(angle*Math.PI/180)*dist}px;
        --dy:${Math.sin(angle*Math.PI/180)*dist}px;
        animation-delay:${Math.random()*0.2}s;
        opacity:0;
      `;
      el.appendChild(s);
    }

    // 大文字
    const txt = document.createElement('div');
    txt.textContent = '关卡通过！';
    txt.style.cssText = `
      font-size:42px;font-weight:bold;color:#ffe066;
      text-shadow:0 0 20px #ffaa00,2px 2px 0 #a06000;
      animation:clearTextPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.2s both;
      opacity:0;
    `;
    el.appendChild(txt);
    container.appendChild(el);

    // 注入 keyframes（只注入一次）
    if (!document.getElementById('clear-anim-style')) {
      const style = document.createElement('style');
      style.id = 'clear-anim-style';
      style.textContent = `
        @keyframes starFly {
          0%   { opacity:1; transform:translate(-50%,-50%) scale(0.5); }
          80%  { opacity:1; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.2); }
          100% { opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.8); }
        }
        @keyframes clearTextPop {
          0%   { opacity:0; transform:scale(0.3); }
          100% { opacity:1; transform:scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      el.remove();
      onDone();
    }, 1100);
  }

  _gameOver() {
    this.busy = true;
    SFX.gameOver();
    this._saveScore(this.score, this.currentLevel + 1, CONFIG.LEVELS[this.currentLevel].monsterName);
    this._showOverlay('💀 失败了', `时间到！得分：${this.score}\n再试一次吧！`, '重新开始');
    this._overlayNextAction = () => this._startLevel(this.currentLevel);
    this._showExtraButtons([
      { text: '选择关卡', action: () => this._showLevelSelect() },
      { text: '返回首页', action: () => this._showHome() }
    ]);
  }

  _playPrincessScene(onDone) {
    const container = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'princess-scene';
    el.style.cssText = `
      position:absolute;inset:0;z-index:95;
      background:linear-gradient(160deg,#0d0820 0%,#1a0a3a 60%,#0d1a30 100%);
      display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;
      opacity:0;transition:opacity 0.6s;
    `;

    const lines = [
      { speaker: '勇士', text: '终极魔王……终于被击败了！', emoji: '⚔️' },
      { speaker: '公主', text: '你来了……我就知道你会来的。', emoji: '👸' },
      { speaker: '勇士', text: '公主，我们回家吧！', emoji: '⚔️' },
      { speaker: '公主', text: '谢谢你，勇敢的战士！', emoji: '👸' },
    ];

    const sceneEl = document.createElement('div');
    sceneEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:20px;width:90%;max-width:340px;';

    // 标题
    const title = document.createElement('div');
    title.textContent = '👸 公主得救了！';
    title.style.cssText = 'font-size:28px;font-weight:bold;color:#ffe066;text-shadow:0 0 20px #ffaa00;opacity:0;transition:opacity 0.5s;';
    sceneEl.appendChild(title);

    // 对话框
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,220,0,0.4);
      border-radius:16px;padding:18px 22px;text-align:center;width:100%;
      min-height:80px;display:flex;flex-direction:column;align-items:center;gap:8px;
    `;
    const speakerEl = document.createElement('div');
    speakerEl.style.cssText = 'font-size:13px;color:#ffe066;font-weight:bold;';
    const textEl = document.createElement('div');
    textEl.style.cssText = 'font-size:16px;color:#fff;line-height:1.6;';
    bubble.appendChild(speakerEl);
    bubble.appendChild(textEl);
    sceneEl.appendChild(bubble);

    el.appendChild(sceneEl);
    container.appendChild(el);

    // 注入 keyframes
    if (!document.getElementById('princess-style')) {
      const style = document.createElement('style');
      style.id = 'princess-style';
      style.textContent = `
        @keyframes princessFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }

    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { title.style.opacity = '1'; }, 400);

    let i = 0;
    const showLine = () => {
      if (i >= lines.length) {
        setTimeout(() => {
          el.style.opacity = '0';
          setTimeout(() => { el.remove(); onDone(); }, 600);
        }, 800);
        return;
      }
      const line = lines[i++];
      speakerEl.textContent = `${line.emoji} ${line.speaker}`;
      textEl.textContent = '';
      // 打字机效果
      let ci = 0;
      const type = () => {
        if (ci < line.text.length) {
          textEl.textContent += line.text[ci++];
          setTimeout(type, 50);
        } else {
          setTimeout(showLine, 1200);
        }
      };
      type();
    };
    setTimeout(showLine, 900);
  }

  _gameWin() {
    this._saveScore(this.score, 9, '终极魔王');
    this._showOverlay(
      '👸 公主得救了！',
      `恭喜你通关全部 9 关！\n最终得分：${this.score}\n\n公主：谢谢你，勇敢的战士！`,
      '再玩一次'
    );
    this._overlayNextAction = () => this._startLevel(0);
    this._showExtraButtons([
      { text: '选择关卡', action: () => this._showLevelSelect() },
      { text: '返回首页', action: () => this._showHome() }
    ]);
  }

  _showOverlayWithChoices(title, msg, nextLvlIdx) {
    this._saveScore(this.score, this.currentLevel + 1, CONFIG.LEVELS[this.currentLevel].monsterName);
    this._showOverlay(title, msg, '下一关');
    this._overlayNextAction = () => this._startLevel(nextLvlIdx);
    this._showExtraButtons([
      { text: '重新挑战', action: () => this._startLevel(this.currentLevel) },
      { text: '选择关卡', action: () => this._showLevelSelect() },
      { text: '返回首页', action: () => this._showHome() }
    ]);
  }

  _showExtraButtons(btns) {
    let row = document.getElementById('overlay-extra-btns');
    if (!row) {
      row = document.createElement('div');
      row.id = 'overlay-extra-btns';
      row.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap;';
      document.getElementById('overlay-box').appendChild(row);
    }
    row.innerHTML = '';
    btns.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'game-btn';
      btn.style.cssText = 'padding:8px 20px;font-size:13px;';
      btn.textContent = b.text;
      btn.addEventListener('click', () => { this._hideOverlay(); b.action(); });
      row.appendChild(btn);
    });
  }

  _showLevelSelect() {
    const overlay = document.getElementById('overlay');
    const box = document.getElementById('overlay-box');
    document.getElementById('overlay-title').textContent = '选择关卡';
    document.getElementById('overlay-msg').textContent = '';
    document.getElementById('overlay-btn').style.display = 'none';

    let grid = document.getElementById('level-select-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'level-select-grid';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;';
      box.insertBefore(grid, document.getElementById('overlay-btn'));
    }
    grid.style.display = 'grid';
    grid.innerHTML = '';

    CONFIG.LEVELS.forEach((lvl, i) => {
      const btn = document.createElement('button');
      btn.className = 'game-btn';
      btn.style.cssText = 'padding:10px 6px;font-size:12px;flex-direction:column;display:flex;align-items:center;gap:2px;';
      btn.innerHTML = `<span style="font-size:22px">${lvl.monster}</span><span>第${lvl.level}关</span><span style="font-size:10px;opacity:0.8">${lvl.monsterName}</span>`;
      btn.addEventListener('click', () => {
        this._hideLevelSelect();
        this._startLevel(i);
      });
      grid.appendChild(btn);
    });

    overlay.classList.remove('hidden');

    // 关闭按钮
    let closeBtn = document.getElementById('level-select-close');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.id = 'level-select-close';
      closeBtn.className = 'game-btn';
      closeBtn.textContent = '取消';
      closeBtn.style.cssText = 'margin-top:4px;padding:8px 28px;font-size:13px;';
      closeBtn.addEventListener('click', () => this._hideLevelSelect());
      box.appendChild(closeBtn);
    }
    closeBtn.style.display = '';
  }

  _hideLevelSelect() {
    const grid = document.getElementById('level-select-grid');
    if (grid) grid.style.display = 'none';
    const closeBtn = document.getElementById('level-select-close');
    if (closeBtn) closeBtn.style.display = 'none';
    document.getElementById('overlay-btn').style.display = '';
    this._hideOverlay();
  }

  _togglePause() {
    this.paused = !this.paused;
    document.getElementById('btn-pause').textContent = this.paused ? '继续' : '暂停';
    if (this.paused) {
      this._showOverlay('⏸ 暂停', '游戏已暂停', '继续游戏');
      this._overlayNextAction = () => { this.paused = false; document.getElementById('btn-pause').textContent = '暂停'; };
      this._showExtraButtons([
        { text: '选择关卡', action: () => this._showLevelSelect() }
      ]);
    }
  }

  _showOverlay(title, msg, btnText) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('overlay-btn').textContent = btnText;
    document.getElementById('overlay-btn').style.display = '';
    // 清空上次的额外按钮并隐藏容器
    const extra = document.getElementById('overlay-extra-btns');
    if (extra) { extra.innerHTML = ''; extra.style.display = 'none'; }
    const grid = document.getElementById('level-select-grid');
    if (grid) grid.style.display = 'none';
    const closeBtn = document.getElementById('level-select-close');
    if (closeBtn) closeBtn.style.display = 'none';
    document.getElementById('overlay').classList.remove('hidden');
  }

  _hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
    this._overlayNextAction = null;
  }

  _overlayAction() {
    const action = this._overlayNextAction;
    this._hideOverlay();
    if (action) action();
  }

  _reshuffleBoard() {
    this.board.init();
    this.renderer.draw(this.board, null);
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
