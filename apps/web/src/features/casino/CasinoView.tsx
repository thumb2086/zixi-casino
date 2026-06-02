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
          <div className="space-y-4 rounded-2xl border border-border/10 bg-card p-20 text-center">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-muted">
              {t('casino.game_unavailable', { game })}
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">
              {t('casino.game_coming_soon')}
            </p>
            <Link
              to="/app/casino/lobby"
              className="mt-8 inline-block rounded-xl bg-accent px-8 py-3 font-black uppercase italic tracking-tighter text-black transition-colors hover:bg-white"
            >
              {t('casino.return_to_floor')}
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Link to="/app/casino/lobby" className="text-secondary transition-colors hover:text-accent">
              <ChevronLeft size={24} />
            </Link>
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-accent" />
              <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-accent">
                {t('casino.title')} <span className="text-muted">/ {currentGameLabel || game}</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell pt-24">{renderGame()}</main>
    </div>
  );
}

