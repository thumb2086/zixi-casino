import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../store/api";

export default function TeamPanel({ company, sessionId }: { company: any; sessionId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [candidate, setCandidate] = useState<any>(null);

  const sum = company.data;

  const hirePreview = useMutation({
    mutationFn: () => api.get("company./api/v1/company/hire-preview", { params: { sessionId } }),
    onSuccess: (res: any) => setCandidate(res.data.data?.candidate),
  });

  const hireConfirm = useMutation({
    mutationFn: (employeeId: string) => api.post("company./api/v1/company/hire", { sessionId, employeeId }),
    onSuccess: () => { setCandidate(null); qc.invalidateQueries({ queryKey: ["company"] }); },
  });

  const fire = useMutation({
    mutationFn: (employeeId: string) => api.post("company./api/v1/company/fire", { sessionId, employeeId }),
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
                <p className="text-caption text-secondary">{t("company.role_" + emp.role)}. {t("company.productivity")} {emp.productivity.toFixed(2)}. {t("company.salary")} {emp.salary}</p>
                <p className="text-[9px] text-secondary">{t("company.leadership")} {emp.leadership.toFixed(2)}. {t("company.traits")} {emp.traits?.join(", ")}</p>
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
          <button onClick={() => hirePreview.mutate()} disabled={hirePreview.isPending} className="w-full bg-accent text-black font-black py-4 rounded-2xl">{t("company.draw_card")}</button>
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
              <button onClick={() => hireConfirm.mutate(candidate.id)} disabled={hireConfirm.isPending} className="flex-1 bg-accent text-black font-black py-3 rounded-xl text-xs">{t("company.hire_confirm")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
