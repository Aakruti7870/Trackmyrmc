import { describe, it, expect } from 'vitest';
import { parseImportCsv } from './importCsv';
// Import the REAL server parser (a pure, dependency-free leaf module) so this
// test exercises both production implementations. If either copy ever changes
// its blank-line filtering or row grid, the shared fixtures below diverge and
// this test fails — the skipped-rows download relies on them staying identical.
import { parseCsv as serverParseCsv } from '../../../server/src/lib/csv';

// Mirrors the blank-line drop both sides apply before numbering rows 1-based
// (server import handler + client buildSkippedRowsCsv). Keeping it here lets the
// contract cover the full row-mapping pipeline, not just the raw parse.
function dropBlankRows(grid: string[][]): string[][] {
  return grid.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Shared fixtures: each must parse to the exact same grid on both sides.
const FIXTURES: { name: string; csv: string }[] = [
  { name: 'simple \\n grid', csv: 'name,lat,lng\nFoo,1,2\nBar,3,4\n' },
  { name: '\\r\\n line endings', csv: 'a,b\r\n1,2\r\n' },
  { name: 'no trailing newline', csv: 'a,b\n1,2' },
  { name: 'quoted comma inside field', csv: 'name,address\n"Foo, Inc","12 Main St, MIDC"\n' },
  { name: 'escaped doubled quotes', csv: 'name\n"She said ""hi"""\n' },
  { name: 'embedded newline inside quotes', csv: 'name,note\nFoo,"line1\nline2"\n' },
  { name: 'blank spacer line between rows', csv: 'name,latitude,longitude\nFoo,1,2\n\nBar,,4\n' },
  { name: 'leading blank line', csv: '\nname,lat,lng\nFoo,1,2\n' },
  { name: 'trailing blank lines', csv: 'name,lat,lng\nFoo,1,2\n\n\n' },
  { name: 'whitespace-only row', csv: 'name,lat,lng\n   ,  ,  \nFoo,1,2\n' },
  { name: 'CRLF with blank spacer', csv: 'name,lat\r\nFoo,1\r\n\r\nBar,2\r\n' },
  { name: 'empty string', csv: '' },
  { name: 'header only', csv: 'name,latitude,longitude\n' },
  { name: 'trailing empty cells', csv: 'a,b,c\n1,,\n' },
  { name: 'unterminated quote at EOF', csv: 'name\n"Foo' },
  { name: 'mixed quoted and bare with reason-like commas', csv: 'name,address\n"Foo, Inc","12 Main, MIDC"\n"Bar ""B""","line1\nline2"\n' },
];

describe('client/server CSV parser contract', () => {
  for (const { name, csv } of FIXTURES) {
    it(`parses identically on client and server: ${name}`, () => {
      const client = parseImportCsv(csv);
      const server = serverParseCsv(csv);
      expect(client).toEqual(server);
    });

    it(`drops blank rows identically (row numbering): ${name}`, () => {
      const client = dropBlankRows(parseImportCsv(csv));
      const server = dropBlankRows(serverParseCsv(csv));
      expect(client).toEqual(server);
    });
  }
});
