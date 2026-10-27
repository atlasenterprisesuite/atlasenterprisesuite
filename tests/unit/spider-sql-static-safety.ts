/** Conservative SQL lexical gate for a checked-in read-only catalog fixture.
 * NOT a SQL parser or a substitute for PostgreSQL read-only transactions.
 */
export function inspectReadOnlySql(source: string): { safe: boolean; reason: string } {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i], next = source[i + 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "-" && next === "-") {
      i += 2; while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2; let depth = 1;
      while (i < source.length && depth) {
        if (source.slice(i, i + 2) === "/*") { depth++; i += 2; }
        else if (source.slice(i, i + 2) === "*/") { depth--; i += 2; }
        else i++;
      }
      if (depth) return { safe: false, reason: "unterminated-comment" };
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c; i++; let closed = false;
      while (i < source.length) {
        if (source[i] === quote) {
          if (source[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) return { safe: false, reason: "unterminated-quote" };
      tokens.push("LITERAL"); continue;
    }
    if (c === "$") {
      const match = source.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        const marker = match[0], end = source.indexOf(marker, i + marker.length);
        if (end < 0) return { safe: false, reason: "unterminated-dollar-quote" };
        i = end + marker.length; tokens.push("LITERAL"); continue;
      }
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = source.slice(i).match(/^[A-Za-z_][A-Za-z_0-9]*/)!;
      tokens.push(m[0].toUpperCase()); i += m[0].length; continue;
    }
    if (c === ";") { tokens.push(";"); i++; continue; }
    if (/[().,=*<>:+/-]/.test(c) || /[0-9]/.test(c)) { i++; continue; }
    return { safe: false, reason: "unsupported-character" };
  }
  const statements: string[][] = []; let statement: string[] = [];
  for (const token of tokens) {
    if (token === ";") { if (statement.length) statements.push(statement); statement = []; }
    else statement.push(token);
  }
  if (statement.length) return { safe: false, reason: "missing-semicolon" };
  if (statements.length < 3 || statements[0].join(" ") !== "BEGIN READ ONLY" ||
      statements.at(-1)?.join(" ") !== "ROLLBACK") return { safe: false, reason: "transaction-envelope" };
  const forbidden = new Set(["INSERT", "UPDATE", "DELETE", "MERGE", "CREATE", "ALTER", "DROP",
    "TRUNCATE", "GRANT", "REVOKE", "CALL", "DO", "COPY", "EXECUTE", "PERFORM", "LOCK",
    "VACUUM", "ANALYZE", "REFRESH", "SET", "RESET", "COMMIT", "SAVEPOINT"]);
  for (const stmt of statements.slice(1, -1)) {
    if (!["SELECT", "WITH"].includes(stmt[0])) return { safe: false, reason: "non-query-statement" };
    if (stmt.some(t => forbidden.has(t))) return { safe: false, reason: "mutating-keyword" };
    if (stmt[0] === "WITH" && !stmt.includes("SELECT")) return { safe: false, reason: "with-without-select" };
  }
  return { safe: true, reason: "lexically-read-only" };
}
