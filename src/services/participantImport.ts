import { validateParticipantRows, type ParticipantImportIssue, type ParticipantValidationResult, type RawParticipantRow } from "../domain/participantValidation";

export function previewParticipantsFromPaste(input: string): ParticipantValidationResult {
  return previewParticipantsFromDelimitedText(input, false);
}

export function previewParticipantsFromCsv(input: string): ParticipantValidationResult {
  return previewParticipantsFromDelimitedText(input, true);
}

function previewParticipantsFromDelimitedText(input: string, allowHeaderRow: boolean): ParticipantValidationResult {
  const parsedRows: RawParticipantRow[] = [];
  const invalidRows: ParticipantImportIssue[] = [];
  const lines = input.split(/\r?\n/);
  let dataRowCount = 0;
  let firstNonEmptyLineSeen = false;

  for (let index = 0; index < lines.length; index += 1) {
    const sourceRow = index + 1;
    const rawLine = lines[index]?.trim();
    if (!rawLine) {
      continue;
    }

    const parsed = parseCsvFields(rawLine);
    if (!parsed.ok) {
      dataRowCount += 1;
      invalidRows.push({
        sourceRow,
        reason: "malformed_row",
        message: parsed.error.message,
      });
      continue;
    }

    if (allowHeaderRow && !firstNonEmptyLineSeen && isHeaderRow(parsed.value)) {
      firstNonEmptyLineSeen = true;
      continue;
    }

    firstNonEmptyLineSeen = true;
    dataRowCount += 1;

    if (parsed.value.length > 2) {
      invalidRows.push({
        sourceRow,
        reason: "malformed_row",
        message: "Participant row must contain only code or code,name.",
      });
      continue;
    }

    parsedRows.push({
      sourceRow,
      code: parsed.value[0],
      ...(parsed.value.length > 1 ? { name: parsed.value[1] } : {}),
    });
  }

  const validation = validateParticipantRows(parsedRows);
  return {
    received: dataRowCount,
    valid: validation.valid,
    duplicateRows: validation.duplicateRows,
    invalidRows: [...invalidRows, ...validation.invalidRows],
  };
}

function parseCsvFields(line: string): ParsedCsvResult {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let quotedField = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += character;
      }
      continue;
    }

    if (character === ",") {
      fields.push(current.trim());
      current = "";
      quotedField = false;
      continue;
    }

    if (character === '"') {
      if (current.trim().length > 0) {
        return malformedCsv(`Unexpected quote in row "${line}".`);
      }

      inQuotes = true;
      quotedField = true;
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    return malformedCsv(`Unclosed quoted field in row "${line}".`);
  }

  fields.push(quotedField ? current.trim() : current.trim());
  return { ok: true, value: fields };
}

function isHeaderRow(fields: readonly string[]): boolean {
  const first = fields[0];
  if (first === undefined) {
    return false;
  }

  const second = fields[1];
  return first.trim().toLowerCase() === "code" && (second === undefined || second.trim().toLowerCase() === "name");
}

type ParsedCsvResult = { ok: true; value: string[] } | { ok: false; error: { message: string } };

function malformedCsv(message: string): ParsedCsvResult {
  return { ok: false, error: { message } };
}
