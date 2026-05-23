const MISSIONS = [
  { id: 'daily_bet', name: '每日下注', desc: '累計下注 10,000 ZXC', target: 10000, reward: 5000 },
  { id: 'daily_win', name: '贏家日', desc: '贏得 5 局遊戲', target: 5, reward: 3000 },
  { id: 'daily_roulette', name: '輪盤手', desc: '玩 3 局輪盤', target: 3, reward: 2000 },
  { id: 'daily_streak', name: '簽到達人', desc: '連續簽到 3 天', target: 3, reward: 8000 },
];

export interface MissionProgress {
  missionId: string;
  progress: number;
  claimed: boolean;
}

export function getMissions(streak: number, todayBet: number, todayWins: number, todayRoulette: number): {
  id: string; name: string; desc: string; target: number; reward: number;
  progress: number; claimed: boolean;
}[] {
  return MISSIONS.map(m => {
    let progress = 0;
    if (m.id === 'daily_bet') progress = Math.min(todayBet, m.target);
    else if (m.id === 'daily_win') progress = Math.min(todayWins, m.target);
    else if (m.id === 'daily_roulette') progress = Math.min(todayRoulette, m.target);
    else if (m.id === 'daily_streak') progress = Math.min(streak, m.target);
    return { ...m, progress, claimed: false };
  });
}
