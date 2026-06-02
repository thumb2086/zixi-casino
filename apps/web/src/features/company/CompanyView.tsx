import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Users, Microscope, Cpu, TrendingUp, DollarSign, ArrowLeft } from "lucide-react";
import { formatNumber } from "@repo/shared";
import { usePreferencesStore } from "../../store/usePreferencesStore";
import { api } from "../../store/api";
import { useAuthStore } from "../../store/useAuthStore";
import AppBottomNav from "../../components/AppBottomNav";

export default function CompanyView() {
  const { t } = useTranslation("company");
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
  const { sessionId } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "hire" | "invest">("dashboard");
  const [candidate, setCandidate] = useState<any>(null);
  const [createMode, setCreateMode] = useState(false);
  const [companyType, setCompanyType] = useState<"ai" | "chip">("ai");
  const [companyName, setCompanyName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

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

  const buyEquipment = useMutation({
    mutationFn: (equipmentType: string) => api.post("/api/v1/company/buy-equipment", { sessionId, equipmentType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const upgradeFab = useMutation({
    mutationFn: () => api.post("/api/v1/company/upgrade-fab", { sessionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const deposit = useMutation({
    mutationFn: (amount: number) => api.post("/api/v1/company/deposit", { sessionId, amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company"] }); qc.invalidateQueries({ queryKey: ["user"] }); },
  });

  const withdraw = useMutation({
    mutationFn: (amount: number) => api.post("/api/v1/company/withdraw", { sessionId, amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company"] }); qc.invalidateQueries({ queryKey: ["user"] }); },
  });

  const company = data?.company;

  if (isLoading) return <div className="min-h-screen bg-surface text-white p-8 text-center">{t("loading")}</div>;

  if (!company && !createMode) {
    return (
      <div className="min-h-screen bg-surface text-white pb-32">
        <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
          <div className="app-shell flex items-center py-4"><h1 className="text-xl font-black text-accent">{t("title")}</h1></div>
        </header>
        <main className="app-shell pt-24 flex flex-col items-center gap-6">
          <Building2 size={64} className="text-muted" />
          <p className="text-lg font-bold">{t("no_company")}</p>
          <button onClick={() => setCreateMode(true)} className="bg-accent text-black font-black px-8 py-3 rounded-2xl">{t("create_company")}</button>
        </main>
        <AppBottomNav current="market" />
      </div>
    );
  }

  if (createMode) {
    return (
      <div className="min-h-screen bg-surface text-white pb-32">
        <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
          <div className="app-shell flex items-center py-4"><h1 className="text-xl font-black text-accent">{t("create_company")}</h1></div>
        </header>
        <main className="app-shell pt-24 flex flex-col gap-6 max-w-md mx-auto">
          <div className="flex gap-2">
            <button onClick={() => setCompanyType("ai")} className={`flex-1 py-3 rounded-xl font-black ${companyType === "ai" ? "bg-accent text-black" : "bg-card text-white"}`}>{t("company_type_ai")}</button>
            <button onClick={() => setCompanyType("chip")} className={`flex-1 py-3 rounded-xl font-black ${companyType === "chip" ? "bg-accent text-black" : "bg-card text-white"}`}>{t("company_type_chip")}</button>
          </div>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t("company_name")} className="w-full rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm" />
          <p className="text-xs text-secondary">{t("startup_fee")}</p>
          <button onClick={() => create.mutate()} disabled={!companyName || create.isPending} className="bg-accent text-black font-black py-3 rounded-2xl disabled:opacity-50">{t("confirm_create")}</button>
          <button onClick={() => setCreateMode(false)} className="text-secondary text-sm">{t("cancel")}</button>
        </main>
        <AppBottomNav current="market" />
      </div>
    );
  }

  const sum = company?.data;

  return (
    <div className="min-h-screen bg-surface text-white pb-32 font-manrope-emoji">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link to="/app/casino/lobby" className="text-secondary"><ArrowLeft size={20} /></Link>
            <Building2 className="text-accent" size={20} />
            <h1 className="text-lg font-black text-accent">{company?.companyName}</h1>
          </div>
        </div>
      </header>

      <main className="app-shell pt-20 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-card p-1">
          {(["dashboard", "hire", "invest"] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab === tb ? "bg-accent text-black" : "text-secondary"}`}>
              {tb === "dashboard" ? t("tab_dashboard") : tb === "hire" ? t("tab_hire") : t("tab_invest")}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card p-4 border border-border/10">
                <p className="text-[10px] text-secondary font-bold">{t(company?.companyType === "ai" ? "company_type_ai" : "company_type_chip")}</p>
                <p className="text-lg font-black text-accent">{t("level_label", { level: company?.level })}</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border/10">
                <p className="text-[10px] text-secondary font-bold">{t("operating_cash")}</p>
                <p className="text-lg font-black text-accent">{nf(sum?.cash || 0)} ZXC</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border/10">
                <p className="text-[10px] text-secondary font-bold">{t("revenue_per_tick")}</p>
                <p className="text-lg font-black text-emerald-400">+{sum?.revenuePerTick || 0}</p>
              </div>
              <div className="rounded-2xl bg-card p-4 border border-border/10">
                <p className="text-[10px] text-secondary font-bold">{t("salary_per_tick")}</p>
                <p className="text-lg font-black text-red-400">-{sum?.costPerTick || 0}</p>
              </div>
            </div>

            {sum?.teamDetails?.length > 0 && (
              <div className="rounded-2xl bg-card p-4 border border-border/10">
                <p className="text-xs font-bold text-secondary mb-2">{t("team_bonus")}</p>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  <span className="text-emerald-400">{t("synergy")} +{sum.teamSynergy}%</span>
                  {sum.teamConflict > 0 && <span className="text-red-400">{t("conflict")} -{sum.teamConflict}%</span>}
                  <span className="text-blue-400">{t("leadership")} +{sum.teamLeadership}%</span>
                  <span className="text-accent">{t("total")} ?{sum.effectiveMultiplier}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {sum.teamDetails?.slice(0, 3).map((d: string, i: number) => (
                    <p key={i} className="text-[10px] text-secondary">{d}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Employees */}
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-secondary">{t("employees", { count: sum?.employeeCount })}</span>
                <button onClick={() => setTab("hire")} className="text-[10px] text-accent">{t("hire_btn")}</button>
              </div>
              <div className="space-y-2">
                {sum?.employees?.map((emp: any) => (
                  <div key={emp.id} className="flex items-center justify-between bg-surface rounded-xl p-3">
                    <div>
                      <p className="text-xs font-bold">{emp.name}</p>
                      <p className="text-[10px] text-secondary">{t("role_" + emp.role)} · {t("productivity")} {emp.productivity.toFixed(2)} · {t("salary")} {emp.salary}</p>
                      <p className="text-[9px] text-secondary">{t("leadership")} {emp.leadership.toFixed(2)} · {t("traits")} {emp.traits?.join("??)}</p>
                    </div>
                    <button onClick={() => fire.mutate(emp.id)} className="text-[10px] text-red-400">{t("fire")}</button>
                  </div>
                ))}
                {(!sum?.employees || sum.employees.length === 0) && <p className="text-xs text-muted text-center py-4">{t("no_employees")}</p>}
              </div>
            </div>

            {/* Products */}
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <p className="text-xs font-bold text-secondary mb-3">{t("products", { count: sum?.products?.length })}</p>
              <div className="space-y-2">
                {sum?.products?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-surface rounded-xl p-3">
                    <div>
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[10px] text-secondary">{t("base_revenue")} {p.baseRevenue}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.3} max={5} step={0.1} value={p.priceMultiplier}
                        onChange={(e) => setPrice.mutate({ productId: p.id, multiplier: Number(e.target.value) })}
                        className="w-20 accent-[#fcc025]" />
                      <span className="text-xs font-bold text-accent w-8 text-right">{p.priceMultiplier.toFixed(1)}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => upgrade.mutate()} disabled={upgrade.isPending}
                className="flex-1 bg-accent/10 text-accent border border-accent/30 py-3 rounded-xl text-xs font-bold">
                {t("upgrade", { level: company?.level + 1, cost: sum?.level * 5000 })}
              </button>
              <button onClick={() => research.mutate()} disabled={research.isPending}
                className="flex-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 py-3 rounded-xl text-xs font-bold">
                {t("research", { progress: sum?.research })}
              </button>
            </div>

            {/* Equipment */}
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <p className="text-xs font-bold text-secondary mb-3">{t("equipment")}</p>
              <div className="flex gap-2">
                <button onClick={() => buyEquipment.mutate("gpu")} disabled={buyEquipment.isPending || (sum?.cash || 0) < 5000}
                  className="flex-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 py-3 rounded-xl text-xs font-bold">
                  {t("gpu", { count: sum?.equipment?.gpu || 0 })}
                </button>
                <button onClick={() => buyEquipment.mutate("supercomputer")} disabled={buyEquipment.isPending || (sum?.cash || 0) < 50000}
                  className="flex-1 bg-violet-500/10 text-violet-400 border border-violet-500/30 py-3 rounded-xl text-xs font-bold">
                  {t("supercomputer", { count: sum?.equipment?.supercomputer || 0 })}
                </button>
              </div>
            </div>

            {company?.companyType === "chip" && (
              <button onClick={() => upgradeFab.mutate()} disabled={upgradeFab.isPending || (sum?.cash || 0) < (sum?.fabLevel || 1) * 10000}
                className="w-full bg-amber-600/20 text-amber-400 border border-amber-600/30 py-3 rounded-xl text-xs font-bold">
                {t("fab_level", { level: sum?.fabLevel, cost: (sum?.fabLevel || 1) * 10000 })}
              </button>
            )}

            {/* Deposit / Withdraw */}
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <p className="text-xs font-bold text-secondary mb-2">{t("operating_cash")} {nf(sum?.cash || 0)} ZXC</p>
              <div className="flex gap-2">
                <input type="number" min={1} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="ZXC" className="flex-1 rounded-xl border border-border/20 bg-surface px-4 py-2 text-sm" />
                <button onClick={() => { const a = parseInt(depositAmount); if (a >= 1) deposit.mutate(a); setDepositAmount(""); }}
                  disabled={deposit.isPending || !depositAmount}
                  className="bg-emerald-600 text-white font-black px-3 py-2 rounded-xl text-xs">{t("deposit_label")}</button>
                <button onClick={() => { const a = parseInt(depositAmount); if (a >= 1) withdraw.mutate(a); setDepositAmount(""); }}
                  disabled={withdraw.isPending || !depositAmount}
                  className="bg-red-600 text-white font-black px-3 py-2 rounded-xl text-xs">{t("withdraw_label")}</button>
              </div>
            </div>
          </div>
        )}

        {tab === "hire" && (
          <div className="space-y-4">
            <p className="text-xs text-secondary">{t("hire_deposit")}</p>
            {!candidate ? (
              <button onClick={() => hirePreview.mutate()} disabled={hirePreview.isPending}
                className="w-full bg-accent text-black font-black py-4 rounded-2xl">{t("draw_card")}</button>
            ) : (
              <div className="rounded-2xl bg-card p-6 border border-accent/30 text-center space-y-3">
                <p className="text-xl font-black">{candidate.name}</p>
                <p className="text-sm text-secondary">{t("role_" + candidate.role)}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-secondary">{t("productivity")}</span><p className="font-black">{candidate.productivity.toFixed(2)}</p></div>
                  <div><span className="text-secondary">{t("leadership")}</span><p className="font-black">{candidate.leadership.toFixed(2)}</p></div>
                  <div><span className="text-secondary">{t("salary")}</span><p className="font-black">{candidate.salary}</p></div>
                  <div><span className="text-secondary">{t("traits")}</span><p className="font-black">{candidate.traits?.join("??)}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCandidate(null)} className="flex-1 border border-border/30 py-3 rounded-xl text-xs">{t("discard")}</button>
                  <button onClick={() => hireConfirm.mutate(candidate.id)} disabled={hireConfirm.isPending}
                    className="flex-1 bg-accent text-black font-black py-3 rounded-xl text-xs">{t("hire_confirm")}</button>
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
  const { t } = useTranslation("company");
  const qc = useQueryClient();
  const [investAmounts, setInvestAmounts] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["company-investable"],
    queryFn: async () => {
      const res = await api.get("/api/v1/company/investable", { params: { sessionId } });
      return res.data.data;
    },
  });

  const invest = useMutation({
    mutationFn: ({ companyId, amount }: { companyId: string; amount: number }) =>
      api.post("/api/v1/company/invest", { sessionId, companyId, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-investable"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-secondary">{t("invest_heading")}</p>
      {data?.companies?.map((c: any) => (
        <div key={c.id} className="rounded-2xl bg-card p-4 border border-border/10 space-y-3">
          <div>
            <p className="text-sm font-bold">{c.companyName}</p>
            <p className="text-[10px] text-secondary">{t("company_info", { type: t(c.companyType === "ai" ? "company_type_ai" : "company_type_chip"), level: c.level, cash: c.data?.cash?.toLocaleString() || 0 })}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text" inputMode="numeric"
              value={investAmounts[c.id] ?? ''}
              onChange={(e) => setInvestAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder={t("invest_amount")}
              className="flex-1 rounded-xl border border-border/20 bg-surface px-4 py-2 text-sm"
            />
            <button
              onClick={() => {
                const amount = parseInt(investAmounts[c.id], 10);
                if (amount && amount >= 100) invest.mutate({ companyId: c.id, amount });
              }}
              disabled={invest.isPending || !investAmounts[c.id] || parseInt(investAmounts[c.id], 10) < 100}
              className="bg-accent text-black font-black px-4 py-2 rounded-xl text-xs disabled:opacity-50"
            >
              {t("invest_btn")}
            </button>
          </div>
        </div>
      ))}
      {(!data?.companies || data.companies.length === 0) && <p className="text-xs text-muted text-center py-8">{t("no_investable")}</p>}
    </div>
  );
}


