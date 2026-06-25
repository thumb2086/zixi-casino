import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, FlaskConical, Users, Monitor, Play, Timer, ChevronRight, Box } from "lucide-react";
import { formatNumber } from "@repo/shared";
import { usePreferencesStore } from "../../store/usePreferencesStore";
import { api } from "../../store/api";
import { useSemiconductor } from "./useSemiconductor";
import TeamPanel from "./TeamPanel";

const CHIP_NAMES: Record<string, string> = {
  zixi_4004: "子熙-4004",
  zixi_8086: "子熙-8086",
  zixi_486: "子熙-486",
};

export default function SemiconductorView({ company, sessionId }: { company: any; sessionId: string }) {
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === "full" ? "full" : "short");
  const { produce, claim, research, craft, assemble } = useSemiconductor();

  const [tab, setTab] = useState<"fab" | "rd" | "team" | "assembly">("fab");

  const sum = company.data;
  const remainingMs = sum?.productionRemainingMs ?? 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const totalSec = Math.max(1, Math.ceil((sum?.productionDuration ?? 1) / 1000));
  const progress = totalSec > 0 ? Math.max(0, Math.min(100, ((totalSec - remainingSec) / totalSec) * 100)) : 0;
  const productionDone = sum?.isProducing && remainingMs <= 0;

  const tabs = [
    { id: "fab" as const, icon: Cpu, label: t("company.tab_fab") },
    { id: "rd" as const, icon: FlaskConical, label: t("company.tab_rd") },
    { id: "team" as const, icon: Users, label: t("company.tab_team") },
    { id: "assembly" as const, icon: Monitor, label: t("company.tab_assembly") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-card p-1">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab === tb.id ? "bg-accent text-black" : "text-secondary"}`}>
            <tb.icon size={14} className="inline mr-1" />{tb.label}
          </button>
        ))}
      </div>

      {tab === "fab" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-4 border border-border/10">
            <p className="text-xs font-bold text-secondary mb-1">{t("company.current_node")}</p>
            <p className="text-lg font-black text-accent">{sum?.nodeName || "-"}</p>
            <p className="text-caption text-secondary">{sum?.nodeDescription || ""}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <p className="text-caption text-secondary font-bold">{t("company.yield_rate")}</p>
              <p className="text-lg font-black text-accent">{sum?.yieldRate ?? 0}%</p>
            </div>
            <div className="rounded-2xl bg-card p-4 border border-border/10">
              <p className="text-caption text-secondary font-bold">{t("company.material_cost")}</p>
              <p className="text-lg font-black text-accent">50 ZXC</p>
            </div>
          </div>

          {sum?.isProducing ? (
            <div className="rounded-2xl bg-card p-4 border border-border/10 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-secondary">{t("company.producing")}</p>
                <Timer size={16} className="text-accent" />
              </div>
              <div className="w-full h-3 rounded-full bg-surface overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-1000"
                  style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <div className="flex justify-between text-caption">
                <span className="text-secondary">{t("company.production_remaining")}</span>
                <span className="font-bold text-accent">{Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}</span>
              </div>
              {productionDone && (
                <button onClick={() => claim.mutate()} disabled={claim.isPending}
                  className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs">
                  {t("company.claim_production")}
                </button>
              )}
            </div>
          ) : (
            <button onClick={() => produce.mutate()} disabled={produce.isPending}
              className="w-full bg-accent text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              <Play size={16} />{t("company.start_production")}
            </button>
          )}

          <div className="rounded-2xl bg-card p-4 border border-border/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-secondary">{t("company.inventory")}</p>
              <Box size={16} className="text-secondary" />
            </div>
            <div className="space-y-2">
              {sum?.inventory && Object.keys(sum.inventory).length > 0 ? (
                (Object.entries(sum.inventory) as [string, number][]).map(([chipId, qty]) => (
                  <div key={chipId} className="flex items-center justify-between bg-surface rounded-xl p-3">
                    <p className="text-xs font-bold">{CHIP_NAMES[chipId] || chipId}</p>
                    <p className="text-xs font-black text-accent">x{qty}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted text-center py-4">{t("company.no_chips")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "rd" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-4 border border-border/10">
            <p className="text-xs font-bold text-secondary mb-1">{t("company.current_node")}</p>
            <p className="text-sm font-black text-accent">{sum?.nodeName || "-"}</p>
            <p className="text-caption text-secondary">{sum?.nodeDescription || ""}</p>
          </div>

          <div className="rounded-2xl bg-card p-4 border border-border/10 space-y-3">
            <p className="text-xs font-bold text-secondary">{t("company.tab_rd")}</p>
            {sum?.techTree?.map((tech: any) => (
              <div key={tech.id} className="flex items-center justify-between bg-surface rounded-xl p-3">
                <div className="flex-1">
                  <p className="text-xs font-bold">{tech.name}</p>
                  <p className="text-[9px] text-secondary">
                    {t("company.tech_level", { level: tech.currentLevel, max: tech.maxLevel })} · {t("company.upgrade_cost", { cost: nf(tech.cost) })}
                  </p>
                  {tech.description && <p className="text-[9px] text-muted">{tech.description}</p>}
                </div>
                {tech.canUpgrade ? (
                  <button onClick={() => research.mutate(tech.id)} disabled={research.isPending}
                    className="bg-accent text-black font-black px-3 py-2 rounded-xl text-xs disabled:opacity-50">
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <span className="text-caption text-muted">{t("company.tech_maxed")}</span>
                )}
              </div>
            ))}
            {(!sum?.techTree || sum.techTree.length === 0) && (
              <p className="text-xs text-muted text-center py-4">{t("company.no_chips")}</p>
            )}
          </div>

          <div className="rounded-2xl bg-card p-4 border border-border/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-secondary">{t("company.breakthrough")}</p>
              <Zap size={14} className="text-accent" />
            </div>
            <p className="text-caption text-secondary">{t("company.breakthrough_desc")}</p>
              {sum?.breakthroughOptions?.map((opt: any) => (
                  <div key={opt.targetNode} className="bg-surface rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold">{opt.description}</p>
                <div className="flex flex-wrap gap-1">
                  {(Object.entries(opt.chipRequirements) as [string, number][]).map(([chipId, qty]) => (
                    <span key={chipId} className="text-caption text-secondary">
                      {CHIP_NAMES[chipId] || chipId} x{qty}
                    </span>
                  ))}
                  <span className="text-caption text-secondary">· {nf(opt.zixiCost)} ZXC</span>
                </div>
                <button onClick={() => craft.mutate(opt.targetNode)} disabled={craft.isPending || !opt.canCraft}
                  className="w-full bg-purple-600 text-white font-black py-2 rounded-xl text-xs disabled:opacity-50">
                  {t("company.craft_btn")}
                </button>
              </div>
            ))}
            {(!sum?.breakthroughOptions || sum.breakthroughOptions.length === 0) && (
              <p className="text-xs text-muted text-center py-2">-</p>
            )}
          </div>
        </div>
      )}

      {tab === "team" && (
          <TeamPanel company={company} sessionId={sessionId} />
      )}

      {tab === "assembly" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-4 border border-border/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-secondary">{t("company.computers")}</p>
              <span className="text-caption text-secondary">{t("company.rack_slots", { used: sum?.rackSlotsUsed ?? 0, max: sum?.rackSlotsMax ?? 0 })}</span>
            </div>
            {sum?.computers?.length > 0 ? (
              <div className="space-y-2">
                {sum.computers.map((comp: any) => (
                  <div key={comp.id} className="flex items-center justify-between bg-surface rounded-xl p-3">
                    <p className="text-xs font-bold">{comp.name}</p>
                    <div className="flex gap-2 text-caption">
                      {comp.effects.durationReduction > 0 && (
                        <span className="text-info">{t("company.production_time_bonus", { sign: "-", pct: Math.round(comp.effects.durationReduction * 100) })}</span>
                      )}
                      {comp.effects.yieldBonus > 0 && (
                        <span className="text-emerald-400">{t("company.yield_bonus", { sign: "+", pct: Math.round(comp.effects.yieldBonus * 100) })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">{t("company.no_computers")}</p>
            )}
          </div>

          <div className="rounded-2xl bg-card p-4 border border-border/10 space-y-3">
            <p className="text-xs font-bold text-secondary">{t("company.tab_assembly")}</p>
            {sum?.computable?.map((comp: any) => (
              <div key={comp.id} className="bg-surface rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">{comp.name}</p>
                  <div className="flex gap-2 text-caption">
                    {comp.effects.durationReduction > 0 && (
                      <span className="text-info">{t("company.production_time_bonus", { sign: "-", pct: Math.round(comp.effects.durationReduction * 100) })}</span>
                    )}
                    {comp.effects.yieldBonus > 0 && (
                      <span className="text-emerald-400">{t("company.yield_bonus", { sign: "+", pct: Math.round(comp.effects.yieldBonus * 100) })}</span>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-secondary">{comp.description}</p>
                <p className="text-caption text-secondary">
                  {t("company.assemble_requirement", { req: (Object.entries(comp.requirements) as [string, number][]).map(([chipId, qty]) => `${CHIP_NAMES[chipId] || chipId} x${qty}`).join(", ") })}
                </p>
                {comp.rackFull ? (
                  <p className="text-caption text-danger">{t("company.rack_slots", { used: comp.rackSlotsUsed, max: comp.rackSlotsMax })}</p>
                ) : (
                  <button onClick={() => assemble.mutate(comp.id)} disabled={assemble.isPending || !comp.canAssemble}
                    className="w-full bg-accent text-black font-black py-2 rounded-xl text-xs disabled:opacity-50">
                    {t("company.assemble_btn")}
                  </button>
                )}
              </div>
            ))}
            {(!sum?.computable || sum.computable.length === 0) && (
              <p className="text-xs text-muted text-center py-4">{t("company.no_computers")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ company, sessionId }: { company: any; sessionId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [candidate, setCandidate] = useState<any>(null);

  const sum = company.data;

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

  return (
    <div className="space-y-4">
      {sum && (
        <div className="rounded-2xl bg-card p-4 border border-border/10">
          <p className="text-xs font-bold text-secondary mb-2">{t("company.team_bonus")}</p>
          <div className="flex gap-2 text-caption flex-wrap">
            <span className="text-emerald-400">{t("company.synergy")} +{sum.teamSynergy}%</span>
            {sum.teamConflict > 0 && <span className="text-red-400">{t("company.conflict")} -{sum.teamConflict}%</span>}
            <span className="text-blue-400">{t("company.leadership")} +{sum.teamLeadership}%</span>
            <span className="text-accent">{t("company.total")} ?{sum.effectiveMultiplier}</span>
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-card p-4 border border-border/10">
        <p className="text-xs font-bold text-secondary mb-3">{t("company.employees", { count: sum?.employeeCount ?? 0 })}</p>
        <div className="space-y-2">
          {sum?.employees?.map((emp: any) => (
            <div key={emp.id} className="flex items-center justify-between bg-surface rounded-xl p-3">
              <div>
                <p className="text-xs font-bold">{emp.name}</p>
                <p className="text-caption text-secondary">
                  {t("company.role_" + emp.role)} · {t("company.productivity")} {emp.productivity.toFixed(2)} · {t("company.salary")} {emp.salary}
                </p>
                <p className="text-[9px] text-secondary">
                  {t("company.leadership")} {emp.leadership.toFixed(2)} · {t("company.traits")} {emp.traits?.join(", ")}
                </p>
              </div>
              <button onClick={() => fire.mutate(emp.id)} className="text-caption text-danger">{t("company.fire")}</button>
            </div>
          ))}
          {(!sum?.employees || sum.employees.length === 0) && (
            <p className="text-xs text-muted text-center py-4">{t("company.no_employees")}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-xs text-secondary">{t("company.hire_deposit")}</p>
        {!candidate ? (
          <button onClick={() => hirePreview.mutate()} disabled={hirePreview.isPending}
            className="w-full bg-accent text-black font-black py-4 rounded-2xl">{t("company.draw_card")}</button>
        ) : (
          <div className="rounded-2xl bg-card p-6 border border-accent/30 text-center space-y-3">
            <p className="text-xl font-black">{candidate.name}</p>
            <p className="text-sm text-secondary">{t("company.role_" + candidate.role)}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-secondary">{t("company.productivity")}</span><p className="font-black">{candidate.productivity.toFixed(2)}</p></div>
              <div><span className="text-secondary">{t("company.leadership")}</span><p className="font-black">{candidate.leadership.toFixed(2)}</p></div>
              <div><span className="text-secondary">{t("company.salary")}</span><p className="font-black">{candidate.salary}</p></div>
              <div><span className="text-secondary">{t("company.traits")}</span><p className="font-black">{candidate.traits?.join(", ")}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCandidate(null)} className="flex-1 border border-border/30 py-3 rounded-xl text-xs">{t("company.discard")}</button>
              <button onClick={() => hireConfirm.mutate(candidate.id)} disabled={hireConfirm.isPending}
                className="flex-1 bg-accent text-black font-black py-3 rounded-xl text-xs">{t("company.hire_confirm")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
