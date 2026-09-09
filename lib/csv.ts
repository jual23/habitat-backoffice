/**
 * 007-finance-ops-expansion (T019, research.md item 3): hand-rolled, fixed
 * two-column (apartment label, amount) CSV parse/generate for the Finance fee
 * template/upload. No library dependency (Principle V) -- this app parses no
 * other CSV anywhere and the shape here is fixed and narrow.
 */

export type FeeCsvRow = { apartmentLabel: string; amount: number };

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Splits one CSV line into fields, honoring double-quoted fields with embedded commas/quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parses an uploaded fee CSV (a header row, then "Apartamento,Cuota" rows).
 * Blank lines are skipped; the first non-blank line is always treated as the
 * header and discarded. Does NOT validate that the apartment label matches a
 * real apartment -- that's `bulkSetFees()`'s job (FR-013's Edge Case: a row
 * naming an unknown apartment is rejected individually, not the whole file).
 */
export function parseFeeCsv(text: string): FeeCsvRow[] {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  const rows: FeeCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i] ?? '');
    const apartmentLabel = (fields[0] ?? '').trim();
    const amountRaw = (fields[1] ?? '').trim();
    if (!apartmentLabel) continue;
    rows.push({ apartmentLabel, amount: Number(amountRaw) });
  }
  return rows;
}

/**
 * Builds the downloadable template: every apartment in column A, its current
 * fee (if any) pre-filled in column B (FR-012).
 */
export function generateFeeCsv(rows: { apartmentLabel: string; amount: number | null }[]): string {
  const header = 'Apartamento,Cuota';
  const lines = rows.map(
    (r) => `${escapeCsvField(r.apartmentLabel)},${r.amount === null ? '' : r.amount}`,
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}
