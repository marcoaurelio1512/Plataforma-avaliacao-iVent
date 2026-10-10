/**
 * Proteção contra "formula injection" (CSV/Excel injection).
 *
 * Texto livre que começa com = + - @ (ou TAB/CR) é interpretado como fórmula
 * por planilhas. Prefixamos um apóstrofo, que as planilhas exibem como texto
 * literal. O banco continua com o original intacto — isto só vale na exportação.
 */
const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
  return DANGEROUS_PREFIX.test(value) ? `'${value}` : value;
}

export type CellValue = string | number | boolean | null | undefined | Date;

export function safeCell(value: CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return neutralizeFormula(value);
  return value;
}

function csvField(value: CellValue): string {
  if (value === null || value === undefined) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const text = typeof value === "string" ? neutralizeFormula(raw) : raw;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV RFC 4180 com BOM UTF-8 (o Excel abre os acentos corretamente). */
export function toCsv(header: readonly string[], rows: readonly CellValue[][]): string {
  const lines = [header.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
