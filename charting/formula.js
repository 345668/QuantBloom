// ---------------------------------------------------------------------------
// Custom-indicator formula engine.
//
// A small, sandboxed expression language for user-defined indicators. It is
// NOT a clone of any vendor's scripting language, and — crucially — it is NOT
// eval/Function: expressions are tokenised, parsed to an AST, and interpreted
// against a fixed whitelist of series, functions and operators. There is no way
// to reach a JS global, a prototype, or arbitrary code from a formula, because
// the interpreter simply has no rule that produces one.
//
// Values are either scalars (numbers) or series (number[] aligned to candles,
// NaN during warm-up). Operators broadcast a scalar across a series.
//
// Grammar:
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/') factor)*
//   factor  := '-' factor | primary
//   primary := number | ident | ident '(' args? ')' | '(' expr ')'
//   args    := expr (',' expr)*
// ---------------------------------------------------------------------------

// --- Tokeniser -------------------------------------------------------------

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isDigit = c => c >= '0' && c <= '9';
  const isIdentStart = c => /[a-zA-Z_]/.test(c);
  const isIdent = c => /[a-zA-Z0-9_]/.test(c);

  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if ('+-*/(),'.includes(c)) { tokens.push({ type: c }); i++; continue; }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let num = '';
      while (i < src.length && (isDigit(src[i]) || src[i] === '.')) num += src[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error(`Bad number "${num}"`);
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    if (isIdentStart(c)) {
      let id = '';
      while (i < src.length && isIdent(src[i])) id += src[i++];
      tokens.push({ type: 'ident', value: id });
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

// --- Parser (recursive descent) --------------------------------------------

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (type) => {
    if (peek().type !== type) throw new Error(`Expected "${type}" but got "${peek().type}"`);
    return next();
  };

  function parseExpr() {
    let left = parseTerm();
    while (peek().type === '+' || peek().type === '-') {
      const op = next().type;
      left = { kind: 'binary', op, left, right: parseTerm() };
    }
    return left;
  }
  function parseTerm() {
    let left = parseFactor();
    while (peek().type === '*' || peek().type === '/') {
      const op = next().type;
      left = { kind: 'binary', op, left, right: parseFactor() };
    }
    return left;
  }
  function parseFactor() {
    if (peek().type === '-') { next(); return { kind: 'neg', operand: parseFactor() }; }
    return parsePrimary();
  }
  function parsePrimary() {
    const t = peek();
    if (t.type === 'number') { next(); return { kind: 'number', value: t.value }; }
    if (t.type === '(') { next(); const e = parseExpr(); expect(')'); return e; }
    if (t.type === 'ident') {
      next();
      if (peek().type === '(') {
        next();
        const args = [];
        if (peek().type !== ')') {
          args.push(parseExpr());
          while (peek().type === ',') { next(); args.push(parseExpr()); }
        }
        expect(')');
        return { kind: 'call', name: t.value, args };
      }
      return { kind: 'ident', name: t.value };
    }
    throw new Error(`Unexpected token "${t.type}"`);
  }

  const ast = parseExpr();
  if (peek().type !== 'eof') throw new Error(`Unexpected trailing "${peek().type}"`);
  return ast;
}

// --- Series maths (warm-up produces NaN) -----------------------------------

const isSeries = v => Array.isArray(v);

function smaArr(x, n) {
  const out = new Array(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) {
    let s = 0, ok = true;
    for (let j = i - n + 1; j <= i; j++) { if (!isFinite(x[j])) { ok = false; break; } s += x[j]; }
    if (ok) out[i] = s / n;
  }
  return out;
}
function emaArr(x, n) {
  const out = new Array(x.length).fill(NaN);
  const k = 2 / (n + 1);
  let e = null;
  for (let i = 0; i < x.length; i++) {
    if (!isFinite(x[i])) continue;
    e = e == null ? x[i] : x[i] * k + e * (1 - k);
    if (i >= n - 1) out[i] = e;
  }
  return out;
}
function stdevArr(x, n) {
  const out = new Array(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) {
    const slice = x.slice(i - n + 1, i + 1);
    if (slice.some(v => !isFinite(v))) continue;
    const m = slice.reduce((a, b) => a + b, 0) / n;
    out[i] = Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  }
  return out;
}
function rsiArr(x, n) {
  const out = new Array(x.length).fill(NaN);
  if (x.length < n + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = x[i] - x[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let ag = gain / n, al = loss / n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < x.length; i++) {
    const d = x[i] - x[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function broadcast(a, b, f) {
  if (!isSeries(a) && !isSeries(b)) return f(a, b);
  const len = isSeries(a) ? a.length : b.length;
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    const av = isSeries(a) ? a[i] : a, bv = isSeries(b) ? b[i] : b;
    out[i] = (isFinite(av) && isFinite(bv)) ? f(av, bv) : NaN;
  }
  return out;
}
const mapVal = (v, f) => isSeries(v) ? v.map(x => (isFinite(x) ? f(x) : NaN)) : f(v);

function asScalar(v, fn) {
  if (isSeries(v)) throw new Error(`${fn}: period must be a constant number, not a series`);
  if (!isFinite(v) || v < 1) throw new Error(`${fn}: period must be >= 1`);
  return Math.floor(v);
}
function asSeries(v, ctx, fn) {
  if (isSeries(v)) return v;
  // Broadcast a scalar to a constant series so functions still work.
  return new Array(ctx.length).fill(v);
}

// Whitelisted functions — the ONLY callables a formula can reach.
const FUNCTIONS = {
  sma: (a, ctx) => smaArr(asSeries(a[0], ctx, 'sma'), asScalar(a[1], 'sma')),
  ema: (a, ctx) => emaArr(asSeries(a[0], ctx, 'ema'), asScalar(a[1], 'ema')),
  stdev: (a, ctx) => stdevArr(asSeries(a[0], ctx, 'stdev'), asScalar(a[1], 'stdev')),
  rsi: (a, ctx) => rsiArr(asSeries(a[0], ctx, 'rsi'), asScalar(a[1], 'rsi')),
  abs: (a) => mapVal(a[0], Math.abs),
  max: (a) => broadcast(a[0], a[1], Math.max),
  min: (a) => broadcast(a[0], a[1], Math.min),
};
const FUNCTION_ARITY = { sma: 2, ema: 2, stdev: 2, rsi: 2, abs: 1, max: 2, min: 2 };

// Whitelisted series identifiers.
const SERIES_IDENTS = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4']);

function evalNode(node, ctx) {
  switch (node.kind) {
    case 'number': return node.value;
    case 'neg': return mapVal(evalNode(node.operand, ctx), x => -x);
    case 'binary': {
      const l = evalNode(node.left, ctx), r = evalNode(node.right, ctx);
      const op = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => (b === 0 ? NaN : a / b) }[node.op];
      return broadcast(l, r, op);
    }
    case 'ident': {
      if (!SERIES_IDENTS.has(node.name)) throw new Error(`Unknown name "${node.name}"`);
      return ctx.series[node.name];
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`Unknown function "${node.name}"`);
      if (node.args.length !== FUNCTION_ARITY[node.name]) {
        throw new Error(`${node.name}() expects ${FUNCTION_ARITY[node.name]} argument(s), got ${node.args.length}`);
      }
      return fn(node.args.map(a => evalNode(a, ctx)), ctx.length);
    }
    default: throw new Error('Bad node');
  }
}

function buildContext(candles) {
  const series = {
    open: candles.map(c => c.open),
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    volume: candles.map(c => c.volume || 0),
    hl2: candles.map(c => (c.high + c.low) / 2),
    hlc3: candles.map(c => (c.high + c.low + c.close) / 3),
    ohlc4: candles.map(c => (c.open + c.high + c.low + c.close) / 4),
  };
  return { series, length: candles.length };
}

/**
 * Compile a formula once. Returns { ok, error } and, when ok, run(candles)
 * producing [{time, value}] with warm-up / invalid points dropped.
 */
export function compileFormula(src) {
  let ast;
  try {
    ast = parse(tokenize(src));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    ast,
    run(candles) {
      if (!candles || !candles.length) return [];
      const ctx = buildContext(candles);
      let result = evalNode(ast, ctx);
      if (!isSeries(result)) result = new Array(candles.length).fill(result);
      const out = [];
      for (let i = 0; i < candles.length; i++) {
        if (isFinite(result[i])) out.push({ time: candles[i].time, value: result[i] });
      }
      return out;
    },
  };
}

/** Validate a formula against a tiny synthetic series; returns {ok, error, sample}. */
export function validateFormula(src) {
  const c = compileFormula(src);
  if (!c.ok) return c;
  try {
    const probe = Array.from({ length: 30 }, (_, i) => ({
      time: i, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1000,
    }));
    const out = c.run(probe);
    return { ok: true, sample: out.length ? out.at(-1).value : null, points: out.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const FORMULA_HELP = {
  series: [...SERIES_IDENTS],
  functions: Object.keys(FUNCTIONS).map(k => `${k}(${k === 'abs' ? 'x' : k === 'max' || k === 'min' ? 'a, b' : 'series, period'})`),
  examples: ['close - sma(close, 20)', '(high + low) / 2', 'ema(close, 12) - ema(close, 26)', 'rsi(close, 14)'],
};
