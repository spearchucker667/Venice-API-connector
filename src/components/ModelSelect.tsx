import React, { useMemo } from "react";
import { ModelInfo } from "../types/venice";
import { Select } from "./ui/select";
import { Meteocon } from "./ui/Meteocon";
import { Trans } from 'react-i18next';

export function ModelSelect({
  value,
  models,
  onChange,
  id,
  className,
  ariaLabel,
  placeholder,
  getLabel,
}: {
  value: string;
  models: ModelInfo[];
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  getLabel?: (model: ModelInfo) => string;
}) {
  const options = useMemo(() => (models || []).map((m) => {
    const label = getLabel ? getLabel(m) : m.name || m.id;
    return {
      value: m.id,
      label,
      element: (
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate mr-2">{label}</span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted shrink-0">
              {m.contextLength ? `${Math.round(m.contextLength / 1000)}k` : ""}
              {m.fidelity === 'high' && <span className="bg-primary/20 text-primary px-1 py-0.5 rounded flex items-center gap-1" title="High Fidelity"><Trans i18nKey="common:surface.componentsModelselect.text.highFidelity" /></span>}
              {m.fidelity === 'standard' && <span className="bg-surface-muted text-text-muted px-1 py-0.5 rounded flex items-center gap-1" title="Standard Fidelity"><Trans i18nKey="common:surface.componentsModelselect.text.standard" /></span>}
              {m.privacy?.mode === 'anonymous' && <span className="bg-success/20 text-success px-1 py-0.5 rounded flex items-center gap-1" title="Anonymous Inference"><Meteocon name="umbrella" size={10} /> <Trans i18nKey="common:surface.componentsModelselect.text.anon" /></span>}
              {(m.privacy?.mode === 'private' || m.privacy?.privateInference) && <span className="bg-accent/20 text-accent px-1 py-0.5 rounded flex items-center gap-1" title="Private Inference"><Meteocon name="umbrella" size={10} /> <Trans i18nKey="common:surface.componentsModelselect.text.private" /></span>}
            </div>
          </div>
        </div>
      ),
    };
  }), [models, getLabel]);

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      className={className || "w-full"}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
    />
  );
}
