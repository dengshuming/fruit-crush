// 游戏配置
const CONFIG = {
  COLS: 9,
  ROWS: 9,
  CELL_SIZE: 46,
  FRUITS: ['🍎', '🍊', '🍋', '🍇', '🍓'],

  LEVELS: [
    {
      level: 1,
      name: '魔法森林',
      monster: '🟢',
      monsterName: '史莱姆',
      bg: 'linear-gradient(160deg, #f953c6 0%, #b91d73 100%)',
      timeLimit: 120,
      targetScore: 500,
      goalText: '消除 500 分',
      monsterHp: 100,
      story: '公主被绑走了！第一关：击败史莱姆！'
    },
    {
      level: 2,
      name: '蘑菇洞穴',
      monster: '🍄',
      monsterName: '毒蘑菇',
      bg: 'linear-gradient(160deg, #f7971e 0%, #ffd200 100%)',
      timeLimit: 120,
      targetScore: 800,
      goalText: '消除 800 分',
      monsterHp: 150,
      story: '继续前进！击败毒蘑菇！'
    },
    {
      level: 3,
      name: '骷髅墓地',
      monster: '💀',
      monsterName: '骷髅兵',
      bg: 'linear-gradient(160deg, #4b6cb7 0%, #182848 100%)',
      timeLimit: 110,
      targetScore: 1200,
      goalText: '消除 1200 分',
      monsterHp: 200,
      story: '骷髅兵挡住了去路！'
    },
    {
      level: 4,
      name: '火焰山脉',
      monster: '🔥',
      monsterName: '火焰魔',
      bg: 'linear-gradient(160deg, #ff416c 0%, #ff4b2b 100%)',
      timeLimit: 110,
      targetScore: 1600,
      goalText: '消除 1600 分',
      monsterHp: 260,
      story: '火焰魔喷出烈焰！小心！'
    },
    {
      level: 5,
      name: '冰雪王国',
      monster: '❄️',
      monsterName: '冰霜巨人',
      bg: 'linear-gradient(160deg, #00c6ff 0%, #0072ff 100%)',
      timeLimit: 100,
      targetScore: 2000,
      goalText: '消除 2000 分',
      monsterHp: 320,
      story: '冰霜巨人冻住了道路！'
    },
    {
      level: 6,
      name: '毒沼泽地',
      monster: '🐸',
      monsterName: '毒蛙王',
      bg: 'linear-gradient(160deg, #56ab2f 0%, #a8e063 100%)',
      timeLimit: 100,
      targetScore: 2500,
      goalText: '消除 2500 分',
      monsterHp: 380,
      story: '毒蛙王喷出毒液！'
    },
    {
      level: 7,
      name: '雷电神殿',
      monster: '⚡',
      monsterName: '雷电魔法师',
      bg: 'linear-gradient(160deg, #c94b4b 0%, #4b134f 100%)',
      timeLimit: 90,
      targetScore: 3000,
      goalText: '消除 3000 分',
      monsterHp: 450,
      story: '雷电魔法师召唤闪电！'
    },
    {
      level: 8,
      name: '暗影城堡',
      monster: '🧛',
      monsterName: '吸血鬼伯爵',
      bg: 'linear-gradient(160deg, #360033 0%, #0b8793 100%)',
      timeLimit: 90,
      targetScore: 3600,
      goalText: '消除 3600 分',
      monsterHp: 520,
      story: '吸血鬼伯爵守护着城堡！'
    },
    {
      level: 9,
      name: '魔王宝座',
      monster: '👹',
      monsterName: '终极魔王',
      bg: 'linear-gradient(160deg, #f12711 0%, #f5af19 100%)',
      timeLimit: 90,
      targetScore: 4500,
      goalText: '消除 4500 分 - 最终决战！',
      monsterHp: 700,
      story: '终极魔王！拯救公主的最后一战！'
    }
  ],

  // 连击伤害倍率
  COMBO_DAMAGE: [1, 1.5, 2, 3, 5],

  // 特殊水果类型
  SPECIAL: {
    BOMB: 'BOMB',       // 4连消
    RAINBOW: 'RAINBOW'  // 5连消
  }
};
