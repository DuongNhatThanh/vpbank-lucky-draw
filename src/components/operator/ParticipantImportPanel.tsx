import type { ReactNode } from "react";
import type { ParticipantImportIssue, ParticipantValidationResult } from "../../domain/participantValidation";

export type InputMode = "paste" | "csv";

export interface ParticipantImportPanelProps {
  inputMode: InputMode;
  pasteValue: string;
  csvFileName: string | null;
  validationPreview: ParticipantValidationResult | null;
  appliedParticipantCount: number;
  canApplyParticipants: boolean;
  onInputModeChange: (mode: InputMode) => void;
  onPasteValueChange: (value: string) => void;
  onPreviewPaste: () => void;
  onCsvFileSelected: (file: File | null) => void;
  onUseDefaultRoster: () => void;
  onClearPreview: () => void;
  onApplyParticipants: () => void;
}

export function ParticipantImportPanel({
  inputMode,
  pasteValue,
  csvFileName,
  validationPreview,
  appliedParticipantCount,
  canApplyParticipants,
  onInputModeChange,
  onPasteValueChange,
  onPreviewPaste,
  onCsvFileSelected,
  onUseDefaultRoster,
  onClearPreview,
  onApplyParticipants,
}: ParticipantImportPanelProps) {
  const validParticipants = validationPreview?.valid ?? [];
  const duplicateRows = validationPreview?.duplicateRows ?? [];
  const invalidRows = validationPreview?.invalidRows ?? [];

  return (
    <section className="panel participant-panel" aria-labelledby="participant-panel-title">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Participant Setup</p>
          <h2 id="participant-panel-title" className="panel__title">
            Import and preview roster
          </h2>
        </div>
        <div className="panel__badge">Applied {appliedParticipantCount}</div>
      </div>

      <div className="metric-grid">
        <Metric label="Received" value={validationPreview?.received ?? 0} />
        <Metric label="Valid" value={validationPreview?.valid.length ?? 0} />
        <Metric label="Duplicates" value={validationPreview?.duplicateRows.length ?? 0} />
        <Metric label="Invalid" value={validationPreview?.invalidRows.length ?? 0} />
      </div>

      <div className="toolbar" role="tablist" aria-label="Participant input mode">
        <button
          type="button"
          className={`segmented-button${inputMode === "paste" ? " is-active" : ""}`}
          aria-pressed={inputMode === "paste"}
          onClick={() => onInputModeChange("paste")}
        >
          Paste
        </button>
        <button
          type="button"
          className={`segmented-button${inputMode === "csv" ? " is-active" : ""}`}
          aria-pressed={inputMode === "csv"}
          onClick={() => onInputModeChange("csv")}
        >
          CSV
        </button>
      </div>

      <div className="input-stack">
        {inputMode === "paste" ? (
          <label className="field">
            <span className="field__label">Paste roster</span>
            <textarea
              value={pasteValue}
              onChange={(event) => onPasteValueChange(event.currentTarget.value)}
              rows={10}
              spellCheck={false}
              placeholder={"0001\n0002,Nguyễn Văn A"}
            />
          </label>
        ) : (
          <label className="field">
            <span className="field__label">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onCsvFileSelected(event.currentTarget.files?.[0] ?? null)}
            />
            <span className="field__hint">{csvFileName ? `Loaded ${csvFileName}` : "Choose a CSV file to preview immediately."}</span>
          </label>
        )}
      </div>

      <div className="action-row">
        <button type="button" className="button button--secondary" onClick={onUseDefaultRoster}>
          Load Default Roster
        </button>
        {inputMode === "paste" ? (
          <button type="button" className="button button--secondary" onClick={onPreviewPaste}>
            Preview
          </button>
        ) : null}
        {validationPreview ? (
          <button type="button" className="button button--secondary" onClick={onClearPreview}>
            Clear Preview
          </button>
        ) : null}
        <button type="button" className="button button--primary" onClick={onApplyParticipants} disabled={!canApplyParticipants}>
          Apply Participants
        </button>
      </div>

      <section className="preview-section" aria-labelledby="preview-title">
        <div className="panel__header panel__header--compact">
          <div>
            <p className="panel__eyebrow">Preview</p>
            <h3 id="preview-title" className="panel__subtitle">
              Validation summary
            </h3>
          </div>
          <span className="panel__badge panel__badge--soft">{validParticipants.length} valid ready</span>
        </div>

        {validationPreview ? (
          <>
            <CompactList title="Valid participants" total={validParticipants.length}>
              {validParticipants.slice(0, 12).map((participant) => (
                <li key={participant.id} className="preview-item">
                  <strong>{participant.code}</strong>
                  {participant.name ? <span>{participant.name}</span> : null}
                </li>
              ))}
            </CompactList>
            <CompactIssues title="Duplicate rows" total={duplicateRows.length} issues={duplicateRows} />
            <CompactIssues title="Invalid rows" total={invalidRows.length} issues={invalidRows} />
          </>
        ) : (
          <p className="empty-state">Load the default roster or preview pasted / CSV data to review the participant list before applying it.</p>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
    </div>
  );
}

function CompactList({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <div className="preview-group">
      <div className="preview-group__header">
        <h4>{title}</h4>
        <span>{total}</span>
      </div>
      <ul className="preview-list">{children}</ul>
    </div>
  );
}

function CompactIssues({ title, total, issues }: { title: string; total: number; issues: readonly ParticipantImportIssue[] }) {
  return (
    <div className="preview-group">
      <div className="preview-group__header">
        <h4>{title}</h4>
        <span>{total}</span>
      </div>
      {issues.length > 0 ? (
        <ul className="issue-list">
          {issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.sourceRow}-${index}`} className="issue-item">
              <span className="issue-item__row">Row {issue.sourceRow}</span>
              <span className="issue-item__detail">
                {issue.code ? <strong>{issue.code}</strong> : null}
                {issue.name ? <span>{issue.name}</span> : null}
                <span>{issue.reason.replaceAll("_", " ")}</span>
                <span>{issue.message}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No {title.toLowerCase()}.</p>
      )}
    </div>
  );
}
