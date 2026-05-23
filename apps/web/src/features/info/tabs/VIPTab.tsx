import { ChevronRight } from 'lucide-react';

export default function VIPTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">VIP 通行證</h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-[#adaaaa]">
          VIP 通行證可在 <span className="text-[#fcc025]">商城</span> 購買，購買後自動啟用對應的 VIP 權限。通行證為永久有效。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">2 個 VIP 等級</h2>

        {/* No VIP */}
        <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#494847]/20 text-sm font-black text-[#adaaaa]">0</div>
            <div className="text-left">
              <h3 className="font-bold text-[#adaaaa]">一般玩家</h3>
              <p className="text-xs font-bold text-[#494847]">無 VIP 通行證</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-bold text-[#adaaaa]">基本遊戲權限</p>
            </div>
          </div>
        </div>

        {/* VIP 1 */}
        <div className="rounded-xl border border-[#fcc025]/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025]/20 text-sm font-black text-[#fcc025]">1</div>
              <div className="text-left">
                <h3 className="font-bold text-[#fcc025]">VIP 1</h3>
                <p className="text-xs font-bold text-[#adaaaa]">購買 VIP 通行證</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#fcc025]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">專屬房間</p>
              <p className="text-sm font-bold text-[#fcc025]">VIP 撲克房</p>
            </div>
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">任務解鎖</p>
              <p className="text-sm font-bold text-[#fcc025]">VIP 限定任務</p>
            </div>
          </div>
        </div>

        {/* VIP 2 */}
        <div className="rounded-xl border border-[#fcc025]/50 bg-gradient-to-r from-[#fcc025]/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025] text-sm font-black text-black">2</div>
              <div className="text-left">
                <h3 className="font-bold text-[#fcc025]">VIP 2</h3>
                <p className="text-xs font-bold text-[#adaaaa]">購買 VIP 2 通行證</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-emerald-400/30 px-2 py-1 text-xs font-bold uppercase text-emerald-400">零手續費</span>
              <ChevronRight className="h-5 w-5 text-[#fcc025]" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">專屬房間</p>
              <p className="text-sm font-bold text-[#fcc025]">全部 VIP 房間</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
              <p className="text-xs font-bold text-emerald-400">⭐ 專屬特權</p>
              <p className="text-sm font-black text-emerald-400">零手續費</p>
              <p className="text-xs font-bold text-[#adaaaa]">市場交易零手續費</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
