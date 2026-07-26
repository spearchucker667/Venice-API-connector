import React from 'react';
import { Chip } from './Chip';
import { DiagnosticsEntry } from '../types/venice';
import { Trans } from 'react-i18next';

export function DiagPreview({ diagnostics }: { diagnostics: Partial<DiagnosticsEntry> | null }) {
  if (!diagnostics) return <Chip><Trans i18nKey="common:surface.componentsDiagnosticspreview.text.noRequestsYet" /></Chip>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone={diagnostics.ok ? "ok" : "danger"}>
        {diagnostics.status ?? "network"} {diagnostics.ok ? "OK" : "error"}
      </Chip>
      <Chip>{diagnostics.endpoint}</Chip>
      {diagnostics.headers?.["CF-RAY"] && (
        <Chip><Trans i18nKey="common:surface.componentsDiagnosticspreview.text.cfRay" /> {diagnostics.headers["CF-RAY"]}</Chip>
      )}
    </div>
  );
}
