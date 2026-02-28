// 棋盘逻辑
class Board {
  constructor() {
    this.cols = CONFIG.COLS;
    this.rows = CONFIG.ROWS;
    this.grid = [];
    this.selected = null;
    this.init();
  }

  init() {
    let attempts = 0;
    do {
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid[r] = [];
        for (let c = 0; c < this.cols; c++) {
          // 生成时避免立即产生3连
          let type;
          let tries = 0;
          do {
            type = Math.floor(Math.random() * CONFIG.FRUITS.length);
            tries++;
          } while (tries < 10 && (
            (c >= 2 && this.grid[r][c-1].type === type && this.grid[r][c-2].type === type) ||
            (r >= 2 && this.grid[r-1][c].type === type && this.grid[r-2][c].type === type)
          ));
          this.grid[r][c] = { type, special: null, falling: false, offsetY: 0, scale: 1, shake: 0 };
        }
      }
      attempts++;
    } while (this._countValidMoves() < 8 && attempts < 20);
  }

  _randomFruit() {
    const idx = Math.floor(Math.random() * CONFIG.FRUITS.length);
    return { type: idx, special: null, falling: false, offsetY: 0, scale: 1, shake: 0 };
  }

  _findMatches() {
    const matched = new Set();
    // 横向
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols - 2; c++) {
        const t = this.grid[r][c].type;
        if (t === this.grid[r][c+1].type && t === this.grid[r][c+2].type) {
          let len = 3;
          while (c + len < this.cols && this.grid[r][c+len].type === t) len++;
          for (let i = 0; i < len; i++) matched.add(`${r},${c+i}`);
        }
      }
    }
    // 纵向
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows - 2; r++) {
        const t = this.grid[r][c].type;
        if (t === this.grid[r+1][c].type && t === this.grid[r+2][c].type) {
          let len = 3;
          while (r + len < this.rows && this.grid[r+len][c].type === t) len++;
          for (let i = 0; i < len; i++) matched.add(`${r+i},${c}`);
        }
      }
    }
    return [...matched].map(k => { const [r,c] = k.split(','); return {r:+r, c:+c}; });
  }

  _countValidMoves() {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (c + 1 < this.cols) {
          this._swap(r, c, r, c+1);
          if (this._findMatches().length > 0) count++;
          this._swap(r, c, r, c+1);
        }
        if (r + 1 < this.rows) {
          this._swap(r, c, r+1, c);
          if (this._findMatches().length > 0) count++;
          this._swap(r, c, r+1, c);
        }
        if (count >= 8) return count;
      }
    }
    return count;
  }

  _hasValidMoves() {
    return this._countValidMoves() > 0;
  }

  _swap(r1, c1, r2, c2) {
    const tmp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = tmp;
  }

  // 尝试交换，返回是否产生匹配；特殊水果直接触发
  trySwap(r1, c1, r2, c2) {
    const cell1 = this.grid[r1][c1];
    const cell2 = this.grid[r2][c2];

    // 彩虹 + 任意水果：消除棋盘上所有该类型水果
    if (cell1.special === CONFIG.SPECIAL.RAINBOW || cell2.special === CONFIG.SPECIAL.RAINBOW) {
      const rainbowPos = cell1.special === CONFIG.SPECIAL.RAINBOW ? {r:r1,c:c1} : {r:r2,c:c2};
      const otherCell  = cell1.special === CONFIG.SPECIAL.RAINBOW ? cell2 : cell1;
      const targetType = otherCell.special ? -1 : otherCell.type; // -1 = 消全场
      this._swap(r1, c1, r2, c2);
      return { special: 'RAINBOW_TRIGGER', rainbowPos, targetType };
    }

    // 炸弹 + 炸弹：超级爆炸 5×5
    if (cell1.special === CONFIG.SPECIAL.BOMB && cell2.special === CONFIG.SPECIAL.BOMB) {
      this._swap(r1, c1, r2, c2);
      return { special: 'DOUBLE_BOMB', r: r1, c: c1 };
    }

    // 普通交换
    this._swap(r1, c1, r2, c2);
    const matches = this._findMatches();

    // 检查交换后是否有炸弹被纳入匹配
    const bombsInMatch = matches.filter(m => this.grid[m.r][m.c] && this.grid[m.r][m.c].special === CONFIG.SPECIAL.BOMB);

    if (matches.length === 0 && bombsInMatch.length === 0) {
      this._swap(r1, c1, r2, c2);
      return null;
    }
    return matches;
  }

  // 消除匹配，返回消除数量和连击长度
  resolveMatches() {
    const matches = this._findMatches();
    if (matches.length === 0) return null;

    const toRemove = new Set(matches.map(m => `${m.r},${m.c}`));

    // 炸弹连锁：匹配中有炸弹则扩展3×3，可连锁触发
    const expandBombs = (set) => {
      const added = [];
      set.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (this.grid[r][c] && this.grid[r][c].special === CONFIG.SPECIAL.BOMB) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const k = `${nr},${nc}`;
                if (!set.has(k)) added.push(k);
              }
            }
          }
        }
      });
      added.forEach(k => set.add(k));
      return added.length > 0;
    };
    while (expandBombs(toRemove)) {}

    const specials = this._detectSpecials(matches);

    toRemove.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      this.grid[r][c] = null;
    });

    specials.forEach(s => {
      this.grid[s.r][s.c] = { type: s.type, special: s.special, falling: false, offsetY: 0, scale: 1.3, shake: 0 };
    });

    this._dropDown();
    this._fillTop();

    const matchArr = [...toRemove].map(k => { const [r,c] = k.split(','); return {r:+r,c:+c}; });
    return { count: toRemove.size, matches: matchArr };
  }

  // 彩虹消除：消除全场指定类型（targetType=-1 则消全场）
  resolveRainbow(targetType) {
    const removed = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        if (targetType === -1 || cell.type === targetType) {
          removed.push({ r, c });
          this.grid[r][c] = null;
        }
      }
    }
    this._dropDown();
    this._fillTop();
    return { count: removed.length, matches: removed };
  }

  // 双炸弹：消除5×5区域
  resolveDoubleBomb(r, c) {
    const removed = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.grid[nr][nc]) {
          removed.push({ r: nr, c: nc });
          this.grid[nr][nc] = null;
        }
      }
    }
    this._dropDown();
    this._fillTop();
    return { count: removed.length, matches: removed };
  }

  _detectSpecials(matches) {
    const specials = [];
    // 简单检测：找连续5+生成彩虹，连续4生成炸弹
    const rows = {};
    const cols = {};
    matches.forEach(m => {
      if (!rows[m.r]) rows[m.r] = [];
      rows[m.r].push(m.c);
      if (!cols[m.c]) cols[m.c] = [];
      cols[m.c].push(m.r);
    });
    // 横向检测
    Object.entries(rows).forEach(([r, cs]) => {
      cs.sort((a,b)=>a-b);
      let run = 1;
      for (let i = 1; i <= cs.length; i++) {
        if (i < cs.length && cs[i] === cs[i-1]+1) { run++; }
        else {
          if (run >= 5) specials.push({ r: +r, c: cs[i-Math.ceil(run/2)], type: matches.find(m=>m.r===+r&&m.c===cs[i-1]).type || 0, special: CONFIG.SPECIAL.RAINBOW });
          else if (run === 4) specials.push({ r: +r, c: cs[i-2], type: 0, special: CONFIG.SPECIAL.BOMB });
          run = 1;
        }
      }
    });
    return specials;
  }

  _dropDown() {
    for (let c = 0; c < this.cols; c++) {
      let empty = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== empty) {
            this.grid[empty][c] = this.grid[r][c];
            this.grid[empty][c].falling = true;
            this.grid[empty][c].offsetY = -(empty - r) * CONFIG.CELL_SIZE;
            this.grid[r][c] = null;
          }
          empty--;
        }
      }
    }
  }

  _fillTop() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === null) {
          this.grid[r][c] = this._randomFruit();
          this.grid[r][c].falling = true;
          this.grid[r][c].offsetY = -(r + 1) * CONFIG.CELL_SIZE;
        }
      }
    }
  }

  isAdjacent(r1, c1, r2, c2) {
    return (Math.abs(r1-r2) + Math.abs(c1-c2)) === 1;
  }
}
