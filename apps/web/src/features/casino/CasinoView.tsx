import { useParams, Link } from 'react-router-dom';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouletteView } from './RouletteView';
import { HorseRacingView } from './HorseRacingView';
import { SlotsView } from './SlotsView';
import { CoinflipView } from './CoinflipView';
import { SicboView } from './SicboView';
import { BingoView } from './BingoView';
import { DuelView } from './DuelView';
import { BlackjackView } from './BlackjackView';
import { DragonTigerView } from './DragonTigerView';
import { PokerView } from './PokerView';
import { BluffDiceView } from './BluffDiceView';
import { CrashView } from './CrashView';

export default function CasinoView() {
  const { game } = useParams();
  const { t } = useTranslation();
  const currentGameLabel = game ? t(`game.${game}`, { defaultValue: game }) : '';

  const renderGame = () => {
    switch (game) {
      case 'roulette':
        return <RouletteView />;
      case 'horse':
        return <HorseRacingView />;
      case 'slots':
        return <SlotsView />;
      case 'coinflip':
        return <CoinflipView />;
      case 'sicbo':
        return <SicboView />;
      case 'bingo':
        return <BingoView />;
      case 'duel':
        return <DuelView />;
      case 'blackjack':
        return <BlackjackView />;
      case 'dragon':
        return <DragonTigerView />;
      case 'poker':
        return <PokerView />;
      case 'bluffdice':
        return <BluffDiceView />;
      case 'crash':
        return <CrashView />;
      default:
        return (
          <div className="space-y-4 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-20 text-center">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-[#494847]">
              {t('casino.game_unavailable', { game })}
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
              {t('casino.game_coming_soon')}
            </p>
            <Link
              to="/app/casino/lobby"
              className="mt-8 inline-block rounded-xl bg-[#fcc025] px-8 py-3 font-black uppercase italic tracking-tighter text-black transition-colors hover:bg-white"
            >
              {t('casino.return_to_floor')}
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-['Manrope'] text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link to="/app/casino/lobby" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
              <ChevronLeft size={24} />
            </Link>
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-[#fcc025]" />
              <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
                {t('casino.title')} <span className="text-[#494847]">/ {currentGameLabel || game}</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell pt-24">{renderGame()}</main>
    </div>
  );
}
