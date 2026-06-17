import { describe, it, expect } from 'vitest';
import { buildSkippedRowsCsv, parseImportCsv, type ImportResult } from './importCsv';

describe('parseImportCsv', () => {
  it('parses a simple grid with \\n line endings', () => {
    expect(parseImportCsv('name,lat,lng\nFoo,1,2\nBar,3,4\n')).toEqual([
      ['name', 'lat', 'lng'],
      ['Foo', '1', '2'],
      ['Bar', '3', '4'],
    ]);
  });

  it('handles \\r\\n line endings the same as \\n', () => {
    expect(parseImportCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps commas inside quoted fields together', () => {
    expect(parseImportCsv('name,address\n"Foo, Inc","12 Main St, MIDC"\n')).toEqual([
      ['name', 'address'],
      ['Foo, Inc', '12 Main St, MIDC'],
    ]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseImportCsv('name\n"She said ""hi"""\n')).toEqual([
      ['name'],
      ['She said "hi"'],
    ]);
  });

  it('keeps newlines inside quoted fields part of the same field', () => {
    expect(parseImportCsv('name,note\nFoo,"line1\nline2"\n')).toEqual([
      ['name', 'note'],
      ['Foo', 'line1\nline2'],
    ]);
  });

  it('captures a final row that has no trailing newline', () => {
    expect(parseImportCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('buildSkippedRowsCsv', () => {
  it('returns the original header plus a trailing "reason" column', () => {
    const csv = 'name,latitude,longitude\nFoo,1,2\nBar,,4\n';
    const result: ImportResult = {
      created: 1,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
      ],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    expect(out).not.toBeNull();
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    expect(lines[0]).toBe('name,latitude,longitude,reason');
  });

  it('includes only skipped rows, never created ones', () => {
    const csv = 'name,latitude,longitude\nFoo,1,2\nBar,,4\nBaz,5,6\n';
    const result: ImportResult = {
      created: 2,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
        { row: 4, name: 'Baz', status: 'created' },
      ],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    expect(lines).toEqual([
      'name,latitude,longitude,reason',
      'Bar,,4,missing latitude',
    ]);
  });

  it('maps each skipped row by its 1-based row number including the header', () => {
    const csv = 'name,latitude,longitude\nFoo,1,2\nBar,,4\nQux,7,8\n';
    const result: ImportResult = {
      created: 2,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
        { row: 4, name: 'Qux', status: 'created' },
      ],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    // Row 3 in the server's numbering is the "Bar" line — pulled by row-1 index.
    expect(lines[1]).toBe('Bar,,4,missing latitude');
  });

  it('filters blank lines exactly like the server so row numbers stay aligned', () => {
    // A blank line sits between Foo and Bar in the raw file. The server filters
    // blank lines before numbering, so "Bar" is still row 3, not row 4.
    const csv = 'name,latitude,longitude\nFoo,1,2\n\nBar,,4\n';
    const result: ImportResult = {
      created: 1,
      skipped: 1,
      results: [
        { row: 2, name: 'Foo', status: 'created' },
        { row: 3, name: 'Bar', status: 'skipped', reason: 'missing latitude' },
      ],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    expect(lines[1]).toBe('Bar,,4,missing latitude');
  });

  it('RFC-4180 quotes fields (and the reason) containing commas, quotes or newlines', () => {
    const csv =
      'name,address\n"Foo, Inc","12 Main, MIDC"\n"Bar ""B""","line1\nline2"\n';
    const result: ImportResult = {
      created: 0,
      skipped: 2,
      results: [
        { row: 2, name: 'Foo, Inc', status: 'skipped', reason: 'duplicate, already exists' },
        { row: 3, name: 'Bar "B"', status: 'skipped', reason: 'bad value' },
      ],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    expect(lines[0]).toBe('name,address,reason');
    // Commas in cells/reason force quoting; the original quoted fields round-trip.
    expect(lines[1]).toBe('"Foo, Inc","12 Main, MIDC","duplicate, already exists"');
    // Doubled quotes are re-escaped; the embedded newline keeps its field quoted,
    // which means this skipped record itself spans two physical lines.
    expect(out).toContain('"Bar ""B""","line1\nline2",bad value');
  });

  it('returns null when there are no skipped rows', () => {
    const csv = 'name,latitude,longitude\nFoo,1,2\n';
    const result: ImportResult = {
      created: 1,
      skipped: 0,
      results: [{ row: 2, name: 'Foo', status: 'created' }],
    };
    expect(buildSkippedRowsCsv(csv, result)).toBeNull();
  });

  it('returns null for an empty CSV', () => {
    const result: ImportResult = { created: 0, skipped: 0, results: [] };
    expect(buildSkippedRowsCsv('', result)).toBeNull();
  });

  it('skips a result whose row number falls outside the grid', () => {
    const csv = 'name,latitude,longitude\nFoo,1,2\n';
    const result: ImportResult = {
      created: 0,
      skipped: 1,
      // Row 9 does not exist in the file — it must be ignored, yielding null.
      results: [{ row: 9, name: 'Ghost', status: 'skipped', reason: 'missing latitude' }],
    };
    expect(buildSkippedRowsCsv(csv, result)).toBeNull();
  });

  it('uses an empty reason cell when a skipped row has no reason', () => {
    const csv = 'name,latitude,longitude\nBar,,4\n';
    const result: ImportResult = {
      created: 0,
      skipped: 1,
      results: [{ row: 2, name: 'Bar', status: 'skipped' }],
    };
    const out = buildSkippedRowsCsv(csv, result)!;
    const lines = out.replace(/\r\n$/, '').split('\r\n');
    expect(lines[1]).toBe('Bar,,4,');
  });
});
