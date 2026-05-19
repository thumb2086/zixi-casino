import React from 'react';
import { Construction } from 'lucide-react';

export const DuelView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <Construction className="w-16 h-16 text-[#fcc025]" />
      <h2 className="text-3xl font-black uppercase italic tracking-tight text-[#fcc025]">PVP 系統</h2>
      <p className="text-lg text-[#adaaaa]">開發中，敬請期待</p>
      <div className="flex items-center gap-2 text-sm text-[#adaaaa]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#fcc025]" />
        即將推出玩家對戰功能
      </div>
    </div>
  );
};
