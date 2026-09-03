// Loughran-McDonald finance-tuned sentiment.
//
// Generic sentiment models mislabel finance text: "liability", "aggressive",
// "tax", "cost" are negative in everyday language but neutral in filings, while
// "growth" and "efficient" carry real signal. Loughran & McDonald (2011) built
// domain-specific word lists for exactly this. Bundled below is a CURATED
// SUBSET of the LM master dictionary (the highest-frequency finance terms in
// each category) — enough to score headlines and short briefs usefully without
// shipping the full ~4k-word lists. Pure and deterministic.

const NEGATIVE = new Set([
  'loss','losses','decline','declines','declined','declining','deficit','weak','weakness','weaker',
  'downturn','recession','default','defaults','defaulted','bankruptcy','bankrupt','insolvency','insolvent',
  'litigation','lawsuit','lawsuits','fraud','fraudulent','misconduct','investigation','investigations',
  'restatement','restated','impairment','impairments','writedown','writeoff','writeoffs','shortfall',
  'downgrade','downgraded','cut','cuts','slump','plunge','plunged','plunges','tumble','tumbled','crash',
  'crisis','distress','distressed','breach','breached','violation','violations','penalty','penalties',
  'fine','fined','sanction','sanctions','recall','recalled','delay','delayed','delays','disruption',
  'disruptions','warning','warned','warns','concern','concerns','risk','risks','risky','uncertain',
  'volatile','volatility','adverse','adversely','negative','negatively','deteriorate','deteriorated',
  'deterioration','underperform','underperformed','underperforming','miss','missed','misses','below',
  'lag','lagged','headwind','headwinds','pressure','pressured','challenging','challenged','difficult',
  'severe','severely','damage','damages','damaged','failure','failed','fails','failing','closure',
  'closures','layoff','layoffs','cutback','cutbacks','suspend','suspended','suspension','halt','halted',
  'unfavorable','unfavourable','shrink','shrank','contraction','contract','drop','dropped','falls','fell',
]);

const POSITIVE = new Set([
  'gain','gains','gained','growth','grow','growing','grew','profit','profits','profitable','strong',
  'strength','stronger','strongest','surge','surged','surges','rally','rallied','soar','soared','beat',
  'beats','exceeded','exceeds','outperform','outperformed','outperforming','record','records',
  'improve','improved','improvement','improvements','improving','upgrade','upgraded','upbeat','robust',
  'solid','positive','positively','favorable','favourable','opportunity','opportunities','efficient',
  'efficiency','expansion','expand','expanded','expanding','momentum','breakthrough','leading','leader',
  'leadership','win','wins','winning','won','success','successful','successfully','boost','boosted',
  'accelerate','accelerated','accelerating','optimistic','optimism','recovery','recover','recovered',
  'rebound','rebounded','tailwind','tailwinds','outstanding','excellent','best','superior','advantage',
]);

const UNCERTAINTY = new Set([
  'may','might','could','uncertain','uncertainty','uncertainties','risk','risks','possible','possibly',
  'approximate','approximately','appears','appear','seems','believe','believes','expect','expects',
  'anticipate','anticipates','estimate','estimates','estimated','contingent','contingency','fluctuate',
  'fluctuation','fluctuations','indefinite','pending','preliminary','probable','speculative','depend',
  'depends','depending','assumption','assumptions','volatile','variable','unknown','unpredictable',
]);

const LITIGIOUS = new Set([
  'litigation','lawsuit','lawsuits','plaintiff','defendant','court','courts','judicial','regulatory',
  'regulation','regulations','sec','subpoena','settlement','settlements','testimony','allegation',
  'allegations','alleged','indictment','indicted','prosecution','prosecutor','compliance','noncompliance',
  'liable','liability','liabilities','damages','injunction','claimant','arbitration','statute','statutory',
  'antitrust','breach','contractual','plea','felony','misdemeanor','whistleblower','fraud',
]);

const NEGATORS = new Set(['not','no','never','none','cannot','without','fails','failed','lack','lacks']);

export function tokenize(text) {
  return (text || '').toLowerCase().match(/[a-z']+/g) || [];
}

// Score a single text. Returns raw counts, a polarity in [-1,1], and a label.
// Negation flips a positive/negative hit within a 3-word window.
export function scoreText(text) {
  const toks = tokenize(text);
  let neg = 0, pos = 0, unc = 0, lit = 0;
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    const negated = toks.slice(Math.max(0, i - 3), i).some(t => NEGATORS.has(t));
    if (NEGATIVE.has(w)) { if (negated) pos++; else neg++; }
    else if (POSITIVE.has(w)) { if (negated) neg++; else pos++; }
    if (UNCERTAINTY.has(w)) unc++;
    if (LITIGIOUS.has(w)) lit++;
  }
  const total = toks.length || 1;
  const denom = pos + neg || 1;
  const polarity = (pos - neg) / denom;           // -1..1 tone
  const label = polarity > 0.15 ? 'bullish' : polarity < -0.15 ? 'bearish' : 'neutral';
  return {
    negative: neg, positive: pos, uncertainty: unc, litigious: lit,
    words: toks.length,
    negProportion: neg / total, posProportion: pos / total,
    polarity: +polarity.toFixed(3), label,
  };
}

// Aggregate LM sentiment across many texts (e.g. a day of headlines).
// Returns a blended polarity, counts, and a label, weighted by hit density.
export function aggregateSentiment(texts) {
  const list = (texts || []).filter(Boolean);
  if (!list.length) return { polarity: 0, label: 'neutral', positive: 0, negative: 0, uncertainty: 0, litigious: 0, n: 0 };
  let pos = 0, neg = 0, unc = 0, lit = 0;
  for (const t of list) {
    const s = scoreText(t);
    pos += s.positive; neg += s.negative; unc += s.uncertainty; lit += s.litigious;
  }
  const denom = pos + neg || 1;
  const polarity = +((pos - neg) / denom).toFixed(3);
  const label = polarity > 0.15 ? 'bullish' : polarity < -0.15 ? 'bearish' : 'neutral';
  return { polarity, label, positive: pos, negative: neg, uncertainty: unc, litigious: lit, n: list.length };
}

export const LM_LISTS = { NEGATIVE, POSITIVE, UNCERTAINTY, LITIGIOUS };
