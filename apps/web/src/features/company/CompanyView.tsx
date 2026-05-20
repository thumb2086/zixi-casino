import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Users, Microscope, Cpu, TrendingUp, DollarSign, ArrowLeft } from "lucide-react";
import { api } from "../../store/api";
import { useAuthStore } from "../../store/useAuthStore";
import AppBottomNav from "../../components/AppBottomNav";

export default function CompanyView() {
  const { t } = useTranslation();
  const { sessionId } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "hire" | "invest">("dashboard");
  const [candidate, setCandidate] = useState<any>(null);
  const [createMode, setCreateMode] = useState(false);
  const [companyType, setCompanyType] = useState<"ai" | "chip">("ai");
  const [companyName, setCompanyName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.get("/api/v1/company", { params: { sessionId } });
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/v1/company/create", { sessionId, companyType, companyName }),
    onSuccess: () => { setCreateMode(false); qc.invalidateQueries({ queryKey: ["company"] }); },
  });

  const hirePreview = useMutation({
    mutationFn: () => api.get("/api/v1/company/hire-preview", { params: { sessionId } }),
    onSuccess: (res: any) => setCandidate(res.data.data?.candidate),
  });

  const hireConfirm = useMutation({
    mutationFn: (employeeId: string) => api.post("/api/v1/company/hire", { sessionId, employeeId }),
    onSuccess: () => { setCandidate(null); qc.invalidateQueries({ queryKey: ["company"] }); },
  });

  const fire = useMutation({
    mutationFn: (employeeId: string) => api.post("/api/v1/company/fire", { sessionId, employeeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const setPrice = useMutation({
    mutationFn: ({ productId, multiplier }: { productId: string; multiplier: number }) =>
      api.post("/api/v1/company/set-price", { sessionId, productId, multiplier }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const upgrade = useMutation({
    mutationFn: () => api.post("/api/v1/company/upgrade", { sessionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const research = useMutation({
    mutationFn: () => api.post("/api/v1/company/research", { sessionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const company = data?.company;

  if (isLoading) return <div className="min-h-screen bg-[#0e0e0e] text-white p-8 text-center">載入中...</div>;

  if (!company && !createMode) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white pb-32">
        <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
          <div className="app-shell flex items-center py-4"><h1 className="text-xl font-black text-[#fcc025]">公司</h1></div>
        </header>
        <main className="app-shell pt-24 flex flex-col items-center gap-6">
          <Building2 size={64} className="text-[#494847]" />
          <p className="text-lg font-bold">你還沒創辦公司</p>
          <button onClick={() => setCreateMode(true)} className="bg-[#fcc025] text-black font-black px-8 py-3 rounded-2xl">創辦公司</button>
        </main>
        <AppBottomNav current="market" />
      </div>
    );
  }

  if (createMode) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white pb-32">
        <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
          <div className="app-shell flex items-center py-4"><h1 className="text-xl font-black text-[#fcc025]">創辦公司</h1></div>
        </header>
        <main className="app-shell pt-24 flex flex-col gap-6 max-w-md mx-auto">
          <div className="flex gap-2">
            <button onClick={() => setCompanyType("ai")} className={`flex-1 py-3 rounded-xl font-black ${companyType === "ai" ? "bg-[#fcc025] text-black" : "bg-[#1a1919] text-white"}`}>AI 公司</button>
            <button onClick={() => setCompanyType("chip")} className={`flex-1 py-3 rounded-xl font-black ${companyType === "chip" ? "bg-[#fcc025] text-black" : "bg-[#1a1919] text-white"}`}>晶片公司</button>
          </div>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="公司名稱" className="w-full rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm" />
          <p className="text-xs text-[#adaaaa]">創辦費用：1,000 ZXC</p>
          <button onClick={() => create.mutate()} disabled={!companyName || create.isPending} className="bg-[#fcc025] text-black font-black py-3 rounded-2xl disabled:opacity-50">確認創辦</button>
          <button onClick={() => setCreateMode(false)} className="text-[#adaaaa] text-sm">取消</button>
        </main>
        <AppBottomNav current="market" />
      </div>
    );
  }

  const sum = company?.data;
  const roleLabel: Record<string, string> = { data_scientist: "資料科學家", engineer: "工程師", researcher: "研究員", chip_designer: "晶片設計師", process_engineer: "製程工程師", materials_scientist: "材料科學家" };
  const typeLabel = company?.companyType === "ai" ? "AI 公司" : "晶片公司";

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white pb-32 font-manrope-emoji">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link to="/app/casino/lobby" className="text-[#adaaaa]"><ArrowLeft size={20} /></Link>
            <Building2 className="text-[#fcc025]" size={20} />
            <h1 className="text-lg font-black text-[#fcc025]">{company?.companyName}</h1>
          </div>
        </div>
      </header>

      <main className="app-shell pt-20 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-[#1a1919] p-1">
          {(["dashboard", "hire", "invest"] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`flex-1 py-2 text-xs font-black rounded-lg ${tab === tb ? "bg-[#fcc025] text-black" : "text-[#adaaaa]"}`}>
              {tb === "dashboard" ? "儀表板" : tb === "hire" ? "雇用" : "投資"}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
                <p className="text-[10px] text-[#adaaaa] font-bold">{typeLabel}</p>
                <p className="text-lg font-black text-[#fcc025]">Lv.{company?.level}</p>
              </div>
              <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
                <p className="text-[10px] text-[#adaaaa] font-bold">營運資金</p>
                <p className="text-lg font-black text-[#fcc025]">{sum?.cash?.toLocaleString() || 0} ZXC</p>
              </div>
              <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
                <p className="text-[10px] text-[#adaaaa] font-bold">營收/tick</p>
                <p className="text-lg font-black text-emerald-400">+{sum?.revenuePerTick || 0}</p>
              </div>
              <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
                <p className="text-[10px] text-[#adaaaa] font-bold">薪資/tick</p>
                <p className="text-lg font-black text-red-400">-{sum?.costPerTick || 0}</p>
              </div>
            </div>

            {sum?.teamDetails?.length > 0 && (
              <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
                <p className="text-xs font-bold text-[#adaaaa] mb-2">團隊加成</p>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  <span className="text-emerald-400">協同 +{sum.teamSynergy}%</span>
                  {sum.teamConflict > 0 && <span className="text-red-400">衝突 -{sum.teamConflict}%</span>}
                  <span className="text-blue-400">領導力 +{sum.teamLeadership}%</span>
                  <span className="text-[#fcc025]">合計 ×{sum.effectiveMultiplier}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {sum.teamDetails?.slice(0, 3).map((d: string, i: number) => (
                    <p key={i} className="text-[10px] text-[#adaaaa]">{d}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Employees */}
            <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#adaaaa]">員工 ({sum?.employeeCount})</span>
                <button onClick={() => setTab("hire")} className="text-[10px] text-[#fcc025]">雇用 +</button>
              </div>
              <div className="space-y-2">
                {sum?.employees?.map((emp: any) => (
                  <div key={emp.id} className="flex items-center justify-between bg-[#0e0e0e] rounded-xl p-3">
                    <div>
                      <p className="text-xs font-bold">{emp.name}</p>
                      <p className="text-[10px] text-[#adaaaa]">{roleLabel[emp.role] || emp.role} · 生產力 {emp.productivity.toFixed(2)} · 薪資 {emp.salary}/tick</p>
                      <p className="text-[9px] text-[#adaaaa]">領導力 {emp.leadership.toFixed(2)} · 特性 {emp.traits?.join("、")}</p>
                    </div>
                    <button onClick={() => fire.mutate(emp.id)} className="text-[10px] text-red-400">解僱</button>
                  </div>
                ))}
                {(!sum?.employees || sum.employees.length === 0) && <p className="text-xs text-[#494847] text-center py-4">尚無員工，快去雇用</p>}
              </div>
            </div>

            {/* Products */}
            <div className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
              <p className="text-xs font-bold text-[#adaaaa] mb-3">產品 ({sum?.products?.length})</p>
              <div className="space-y-2">
                {sum?.products?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-[#0e0e0e] rounded-xl p-3">
                    <div>
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[10px] text-[#adaaaa]">基礎營收 {p.baseRevenue}/tick</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.3} max={5} step={0.1} value={p.priceMultiplier}
                        onChange={(e) => setPrice.mutate({ productId: p.id, multiplier: Number(e.target.value) })}
                        className="w-20 accent-[#fcc025]" />
                      <span className="text-xs font-bold text-[#fcc025] w-8 text-right">{p.priceMultiplier.toFixed(1)}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => upgrade.mutate()} disabled={upgrade.isPending}
                className="flex-1 bg-[#fcc025]/10 text-[#fcc025] border border-[#fcc025]/30 py-3 rounded-xl text-xs font-black">
                升級 Lv.{company?.level + 1}（{sum?.level * 5000} ZXC）
              </button>
              <button onClick={() => research.mutate()} disabled={research.isPending}
                className="flex-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 py-3 rounded-xl text-xs font-black">
                研發投入 1,000 ZXC（{sum?.research}/100）
              </button>
            </div>
            {company?.companyType === "chip" && (
              <p className="text-xs text-[#adaaaa] text-center">晶圓廠 Lv.{sum?.fabLevel} · 升級 {(sum?.fabLevel || 1) * 10000} ZXC</p>
            )}
          </div>
        )}

        {tab === "hire" && (
          <div className="space-y-4">
            <p className="text-xs text-[#adaaaa]">雇用員工需要從錢包支付首月薪資的 10 倍保證金</p>
            {!candidate ? (
              <button onClick={() => hirePreview.mutate()} disabled={hirePreview.isPending}
                className="w-full bg-[#fcc025] text-black font-black py-4 rounded-2xl">抽卡</button>
            ) : (
              <div className="rounded-2xl bg-[#1a1919] p-6 border border-[#fcc025]/30 text-center space-y-3">
                <p className="text-xl font-black">{candidate.name}</p>
                <p className="text-sm text-[#adaaaa]">{roleLabel[candidate.role]}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-[#adaaaa]">生產力</span><p className="font-black">{candidate.productivity.toFixed(2)}</p></div>
                  <div><span className="text-[#adaaaa]">領導力</span><p className="font-black">{candidate.leadership.toFixed(2)}</p></div>
                  <div><span className="text-[#adaaaa]">薪資/tick</span><p className="font-black">{candidate.salary}</p></div>
                  <div><span className="text-[#adaaaa]">特性</span><p className="font-black">{candidate.traits?.join("、")}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCandidate(null)} className="flex-1 border border-[#494847]/30 py-3 rounded-xl text-xs">放棄</button>
                  <button onClick={() => hireConfirm.mutate(candidate.id)} disabled={hireConfirm.isPending}
                    className="flex-1 bg-[#fcc025] text-black font-black py-3 rounded-xl text-xs">雇用</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "invest" && <InvestView sessionId={sessionId} />}
      </main>
      <AppBottomNav current="market" />
    </div>
  );
}

function InvestView({ sessionId }: { sessionId: string }) {
  const { data } = useQuery({
    queryKey: ["company-investable"],
    queryFn: async () => {
      const res = await api.get("/api/v1/company/investable", { params: { sessionId } });
      return res.data.data;
    },
  });
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#adaaaa]">可投資的公司</p>
      {data?.companies?.map((c: any) => (
        <div key={c.id} className="rounded-2xl bg-[#1a1919] p-4 border border-[#494847]/10">
          <p className="text-sm font-bold">{c.companyName}</p>
          <p className="text-[10px] text-[#adaaaa]">{c.companyType === "ai" ? "AI" : "晶片"} · Lv.{c.level}</p>
        </div>
      ))}
      {(!data?.companies || data.companies.length === 0) && <p className="text-xs text-[#494847] text-center py-8">尚無其他公司可投資</p>}
    </div>
  );
}
