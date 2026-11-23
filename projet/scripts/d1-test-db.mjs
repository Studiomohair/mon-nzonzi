// Base D1 simulée avec node:sqlite, migrations réelles appliquées dans l'ordre.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function createTestDb() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  const DB = { prepare(sql) {
    const statement = db.prepare(sql);
    return { bind(...args) { return {
      first: async () => statement.get(...args) ?? null,
      all: async () => ({ results: statement.all(...args) }),
      run: async () => statement.run(...args),
    }; } };
  } };
  return { db, DB };
}
