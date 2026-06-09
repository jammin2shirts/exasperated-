'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Bracket = [number, number, number]; // [min, max, rate]
type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

interface StateTaxInfo {
  name: string;
  /** Standard deduction (or personal exemption) for a single filer. */
  standardDeduction: number;
  /** Marginal brackets applied to taxable income (after std deduction). */
  brackets: Bracket[];
  notes?: string;
}

// Upper sentinel for the top bracket (no real income reaches $1 billion).
// Using an explicit constant avoids the `1/0` minification pattern.
const TOP = 1_000_000_000;

// ─── Federal 2026 Brackets ────────────────────────────────────────────────────
// Projected from IRS Rev. Proc. 2024-40 (2025 rates) with ~2.8% inflation
// adjustment. Assumes TCJA rates continue; will be revised if Congress acts.

const FEDERAL_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    [0,       12_260,  0.10],
    [12_260,  49_840,  0.12],
    [49_840,  106_250, 0.22],
    [106_250, 202_850, 0.24],
    [202_850, 257_540, 0.32],
    [257_540, 643_890, 0.35],
    [643_890, TOP, 0.37],
  ],
  mfj: [
    [0,       24_520,  0.10],
    [24_520,  99_680,  0.12],
    [99_680,  212_490, 0.22],
    [212_490, 405_650, 0.24],
    [405_650, 515_080, 0.32],
    [515_080, 772_640, 0.35],
    [772_640, TOP, 0.37],
  ],
  mfs: [
    [0,       12_260,  0.10],
    [12_260,  49_840,  0.12],
    [49_840,  106_250, 0.22],
    [106_250, 202_850, 0.24],
    [202_850, 257_540, 0.32],
    [257_540, 386_320, 0.35],
    [386_320, TOP, 0.37],
  ],
  hoh: [
    [0,       17_480,  0.10],
    [17_480,  66_670,  0.12],
    [66_670,  106_250, 0.22],
    [106_250, 202_850, 0.24],
    [202_850, 257_510, 0.32],
    [257_510, 643_890, 0.35],
    [643_890, TOP, 0.37],
  ],
};

const FEDERAL_STD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15_420,
  mfj:    30_840,
  mfs:    15_420,
  hoh:    23_130,
};

// ─── State Tax Data (2026) ────────────────────────────────────────────────────
// Sources: Tax Foundation 2025 State Individual Income Tax Guide, state DOR
// websites, and projected statutory changes effective for tax year 2026.
// Brackets shown are for SINGLE filers. Does not include local/city taxes,
// FICA, AMT, surtaxes, or refundable credits unless noted.

const STATE_TAX: Record<string, StateTaxInfo> = {
  AL: {
    name: 'Alabama',
    standardDeduction: 3_000,
    brackets: [
      [0,     500,      0.020],
      [500,   3_000,    0.040],
      [3_000, TOP, 0.050],
    ],
  },
  AK: {
    name: 'Alaska',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
  AZ: {
    name: 'Arizona',
    standardDeduction: 14_600,
    brackets: [[0, TOP, 0.025]],
    notes: 'Flat 2.5%',
  },
  AR: {
    name: 'Arkansas',
    standardDeduction: 2_200,
    brackets: [
      [0,     4_900,    0.020],
      [4_900, 9_300,    0.030],
      [9_300, TOP, 0.039],
    ],
    notes: 'Top rate 3.9% (2026 after recent cuts)',
  },
  CA: {
    name: 'California',
    standardDeduction: 5_540,
    brackets: [
      [0,       10_756,  0.010],
      [10_756,  25_499,  0.020],
      [25_499,  40_245,  0.040],
      [40_245,  55_866,  0.060],
      [55_866,  70_606,  0.080],
      [70_606,  360_659, 0.093],
      [360_659, 432_787, 0.103],
      [432_787, 721_314, 0.113],
      [721_314, 1_000_000, 0.123],
      [1_000_000, TOP, 0.133],
    ],
  },
  CO: {
    name: 'Colorado',
    standardDeduction: 14_600,
    brackets: [[0, TOP, 0.044]],
    notes: 'Flat 4.4%',
  },
  CT: {
    name: 'Connecticut',
    standardDeduction: 0,
    brackets: [
      [0,       10_000,  0.020],
      [10_000,  50_000,  0.045],
      [50_000,  100_000, 0.055],
      [100_000, 200_000, 0.060],
      [200_000, 250_000, 0.065],
      [250_000, 500_000, 0.069],
      [500_000, TOP, 0.0699],
    ],
  },
  DC: {
    name: 'Washington D.C.',
    standardDeduction: 14_600,
    brackets: [
      [0,       10_000,  0.040],
      [10_000,  40_000,  0.060],
      [40_000,  60_000,  0.065],
      [60_000,  250_000, 0.085],
      [250_000, 500_000, 0.0925],
      [500_000, 1_000_000, 0.0975],
      [1_000_000, TOP, 0.1075],
    ],
  },
  DE: {
    name: 'Delaware',
    standardDeduction: 3_250,
    brackets: [
      [0,      2_000,  0.000],
      [2_000,  5_000,  0.022],
      [5_000,  10_000, 0.039],
      [10_000, 20_000, 0.048],
      [20_000, 25_000, 0.052],
      [25_000, 60_000, 0.0555],
      [60_000, TOP, 0.066],
    ],
  },
  FL: {
    name: 'Florida',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
  GA: {
    name: 'Georgia',
    standardDeduction: 12_000,
    brackets: [[0, TOP, 0.0529]],
    notes: 'Flat 5.29% (2026)',
  },
  HI: {
    name: 'Hawaii',
    standardDeduction: 2_200,
    brackets: [
      [0,       2_400,   0.014],
      [2_400,   4_800,   0.032],
      [4_800,   9_600,   0.055],
      [9_600,   14_400,  0.064],
      [14_400,  19_200,  0.068],
      [19_200,  24_000,  0.072],
      [24_000,  36_000,  0.076],
      [36_000,  48_000,  0.079],
      [48_000,  150_000, 0.0825],
      [150_000, 175_000, 0.090],
      [175_000, 200_000, 0.100],
      [200_000, TOP, 0.110],
    ],
  },
  ID: {
    name: 'Idaho',
    standardDeduction: 14_600,
    brackets: [[0, TOP, 0.058]],
    notes: 'Flat 5.8%',
  },
  IL: {
    name: 'Illinois',
    standardDeduction: 2_425,
    brackets: [[0, TOP, 0.0495]],
    notes: 'Flat 4.95% (personal exemption used as deduction proxy)',
  },
  IN: {
    name: 'Indiana',
    standardDeduction: 0,
    brackets: [[0, TOP, 0.0305]],
    notes: 'Flat 3.05%; county taxes not included',
  },
  IA: {
    name: 'Iowa',
    standardDeduction: 14_600,
    brackets: [[0, TOP, 0.035]],
    notes: 'Flat 3.5% (2026, phased in)',
  },
  KS: {
    name: 'Kansas',
    standardDeduction: 3_500,
    brackets: [
      [0,      15_000,  0.031],
      [15_000, 30_000,  0.0525],
      [30_000, TOP, 0.057],
    ],
  },
  KY: {
    name: 'Kentucky',
    standardDeduction: 3_160,
    brackets: [[0, TOP, 0.040]],
    notes: 'Flat 4.0%',
  },
  LA: {
    name: 'Louisiana',
    standardDeduction: 4_500,
    brackets: [[0, TOP, 0.030]],
    notes: 'Flat 3% (enacted late 2024, effective 2025/2026)',
  },
  ME: {
    name: 'Maine',
    standardDeduction: 14_600,
    brackets: [
      [0,      26_050,  0.058],
      [26_050, 61_600,  0.0675],
      [61_600, TOP, 0.0715],
    ],
  },
  MD: {
    name: 'Maryland',
    standardDeduction: 2_400,
    brackets: [
      [0,       1_000,   0.020],
      [1_000,   2_000,   0.030],
      [2_000,   3_000,   0.040],
      [3_000,   100_000, 0.0475],
      [100_000, 125_000, 0.050],
      [125_000, 150_000, 0.0525],
      [150_000, 250_000, 0.055],
      [250_000, TOP, 0.0575],
    ],
    notes: 'State rate only; local/county tax (up to 3.2%) not included',
  },
  MA: {
    name: 'Massachusetts',
    standardDeduction: 0,
    brackets: [[0, TOP, 0.050]],
    notes: 'Flat 5%; 4% surtax on income > $1 M not included',
  },
  MI: {
    name: 'Michigan',
    standardDeduction: 5_600,
    brackets: [[0, TOP, 0.0425]],
    notes: 'Flat 4.25% (personal exemption used)',
  },
  MN: {
    name: 'Minnesota',
    standardDeduction: 14_575,
    brackets: [
      [0,       30_070,  0.0535],
      [30_070,  98_760,  0.068],
      [98_760,  183_340, 0.0785],
      [183_340, TOP, 0.0985],
    ],
  },
  MS: {
    name: 'Mississippi',
    standardDeduction: 2_300,
    brackets: [
      [0,      10_000,  0.000],
      [10_000, TOP, 0.047],
    ],
    notes: 'No tax on first $10 K; 4.7% flat above',
  },
  MO: {
    name: 'Missouri',
    standardDeduction: 14_600,
    brackets: [
      [0,     1_207,  0.015],
      [1_207, 2_414,  0.020],
      [2_414, 3_621,  0.025],
      [3_621, 4_828,  0.030],
      [4_828, 6_035,  0.035],
      [6_035, 7_242,  0.040],
      [7_242, 8_449,  0.045],
      [8_449, TOP, 0.047],
    ],
    notes: 'Top rate 4.7% (2026 after reductions)',
  },
  MT: {
    name: 'Montana',
    standardDeduction: 5_840,
    brackets: [
      [0,      20_500,  0.047],
      [20_500, TOP, 0.059],
    ],
  },
  NE: {
    name: 'Nebraska',
    standardDeduction: 7_900,
    brackets: [
      [0,      3_700,   0.0246],
      [3_700,  22_170,  0.0351],
      [22_170, 35_730,  0.0501],
      [35_730, TOP, 0.052],
    ],
    notes: 'Top rate reduced to 5.2% (2026)',
  },
  NV: {
    name: 'Nevada',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
  NH: {
    name: 'New Hampshire',
    standardDeduction: 0,
    brackets: [],
    notes: 'No income tax on wages (interest & dividends tax fully repealed 2025)',
  },
  NJ: {
    name: 'New Jersey',
    standardDeduction: 0,
    brackets: [
      [0,       20_000,  0.014],
      [20_000,  35_000,  0.0175],
      [35_000,  40_000,  0.035],
      [40_000,  75_000,  0.05525],
      [75_000,  500_000, 0.0637],
      [500_000, 1_000_000, 0.0897],
      [1_000_000, TOP, 0.1075],
    ],
  },
  NM: {
    name: 'New Mexico',
    standardDeduction: 14_600,
    brackets: [
      [0,       5_500,   0.017],
      [5_500,   11_000,  0.032],
      [11_000,  16_000,  0.047],
      [16_000,  210_000, 0.049],
      [210_000, TOP, 0.059],
    ],
  },
  NY: {
    name: 'New York',
    standardDeduction: 8_000,
    brackets: [
      [0,         17_150,    0.040],
      [17_150,    23_600,    0.045],
      [23_600,    27_900,    0.0525],
      [27_900,    43_000,    0.055],
      [43_000,    161_550,   0.060],
      [161_550,   323_200,   0.0685],
      [323_200,   2_155_350, 0.0965],
      [2_155_350, 25_000_000, 0.103],
      [25_000_000, TOP, 0.109],
    ],
    notes: 'State rate only; NYC/Yonkers surcharges not included',
  },
  NC: {
    name: 'North Carolina',
    standardDeduction: 14_600,
    brackets: [[0, TOP, 0.0399]],
    notes: 'Flat 3.99% (2026)',
  },
  ND: {
    name: 'North Dakota',
    standardDeduction: 14_600,
    brackets: [
      [0,       44_725,  0.000],
      [44_725,  225_950, 0.0195],
      [225_950, TOP, 0.025],
    ],
    notes: '0% on income up to $44,725',
  },
  OH: {
    name: 'Ohio',
    standardDeduction: 0,
    brackets: [
      [0,       26_050,  0.000],
      [26_050,  46_100,  0.0275],
      [46_100,  100_000, 0.03226],
      [100_000, TOP, 0.035],
    ],
    notes: '0% on income ≤ $26,050',
  },
  OK: {
    name: 'Oklahoma',
    standardDeduction: 6_350,
    brackets: [
      [0,     1_000,  0.0025],
      [1_000, 2_500,  0.0075],
      [2_500, 3_750,  0.0175],
      [3_750, 4_900,  0.0275],
      [4_900, 7_200,  0.0375],
      [7_200, TOP, 0.0475],
    ],
  },
  OR: {
    name: 'Oregon',
    standardDeduction: 2_420,
    brackets: [
      [0,       3_750,   0.0475],
      [3_750,   9_450,   0.0675],
      [9_450,   125_000, 0.0875],
      [125_000, TOP, 0.099],
    ],
  },
  PA: {
    name: 'Pennsylvania',
    standardDeduction: 0,
    brackets: [[0, TOP, 0.0307]],
    notes: 'Flat 3.07%; local taxes not included',
  },
  RI: {
    name: 'Rhode Island',
    standardDeduction: 10_550,
    brackets: [
      [0,       77_450,  0.0375],
      [77_450,  176_050, 0.0475],
      [176_050, TOP, 0.0599],
    ],
  },
  SC: {
    name: 'South Carolina',
    standardDeduction: 14_600,
    brackets: [
      [0,      3_460,  0.030],
      [3_460,  6_520,  0.040],
      [6_520,  9_980,  0.050],
      [9_980,  13_480, 0.060],
      [13_480, TOP, 0.063],
    ],
    notes: 'Top rate 6.3% (2026, reducing annually toward 6%)',
  },
  SD: {
    name: 'South Dakota',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
  TN: {
    name: 'Tennessee',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax on wages',
  },
  TX: {
    name: 'Texas',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
  UT: {
    name: 'Utah',
    standardDeduction: 0,
    brackets: [[0, TOP, 0.0455]],
    notes: 'Flat 4.55%; personal exemption credit not modeled',
  },
  VT: {
    name: 'Vermont',
    standardDeduction: 7_000,
    brackets: [
      [0,       45_400,  0.0335],
      [45_400,  110_050, 0.066],
      [110_050, 229_550, 0.076],
      [229_550, TOP, 0.0875],
    ],
  },
  VA: {
    name: 'Virginia',
    standardDeduction: 8_000,
    brackets: [
      [0,      3_000,  0.020],
      [3_000,  5_000,  0.030],
      [5_000,  17_000, 0.050],
      [17_000, TOP, 0.0575],
    ],
  },
  WA: {
    name: 'Washington',
    standardDeduction: 0,
    brackets: [],
    notes: 'No general income tax (capital gains tax on investment income not included)',
  },
  WV: {
    name: 'West Virginia',
    standardDeduction: 0,
    brackets: [
      [0,      10_000,  0.020],
      [10_000, 25_000,  0.025],
      [25_000, 40_000,  0.030],
      [40_000, 60_000,  0.040],
      [60_000, TOP, 0.045],
    ],
    notes: 'Reduced rates per 2024 legislation',
  },
  WI: {
    name: 'Wisconsin',
    standardDeduction: 12_160,
    brackets: [
      [0,       13_810,  0.0354],
      [13_810,  27_630,  0.044],
      [27_630,  304_170, 0.053],
      [304_170, TOP, 0.0765],
    ],
  },
  WY: {
    name: 'Wyoming',
    standardDeduction: 0,
    brackets: [],
    notes: 'No state income tax',
  },
};

// ─── Calculation Helpers ──────────────────────────────────────────────────────

function applyBrackets(income: number, brackets: Bracket[]): number {
  if (income <= 0 || brackets.length === 0) return 0;
  let tax = 0;
  for (const [min, max, rate] of brackets) {
    if (income <= min) break;
    tax += (Math.min(income, max) - min) * rate;
  }
  return Math.max(0, tax);
}

function federalTax(gross: number, status: FilingStatus): number {
  const taxable = Math.max(0, gross - FEDERAL_STD_DEDUCTION[status]);
  return applyBrackets(taxable, FEDERAL_BRACKETS[status]);
}

function stateTax(gross: number, code: string): number {
  const info = STATE_TAX[code];
  if (!info || info.brackets.length === 0) return 0;
  const taxable = Math.max(0, gross - info.standardDeduction);
  return applyBrackets(taxable, info.brackets);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (n: number) => (n * 100).toFixed(1) + '%';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultCard({
  label,
  value,
  sub,
  variant = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  variant?: 'default' | 'accent' | 'green';
}) {
  const bg =
    variant === 'accent'
      ? 'bg-zinc-900 dark:bg-zinc-700'
      : 'bg-zinc-50 dark:bg-zinc-800';
  const valueColor =
    variant === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : variant === 'accent'
      ? 'text-white'
      : 'text-zinc-900 dark:text-zinc-50';
  const labelColor = variant === 'accent' ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400';
  const subColor = variant === 'accent' ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400';

  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-medium ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor}`}>{value}</p>
      <p className={`mt-0.5 text-xs ${subColor}`}>{sub}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILING_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
};

export default function CalculatorPage() {
  const [income, setIncome] = useState('75000');
  const [status, setStatus] = useState<FilingStatus>('single');
  const [selectedState, setSelectedState] = useState('TX');

  const gross = Math.max(0, parseFloat(income.replace(/[^0-9.]/g, '')) || 0);

  const fedTax = useMemo(() => federalTax(gross, status), [gross, status]);
  const stTax = useMemo(() => stateTax(gross, selectedState), [gross, selectedState]);
  const totalTax = fedTax + stTax;
  const takeHome = gross - totalTax;
  const effRate = gross > 0 ? totalTax / gross : 0;

  const sortedStates = useMemo(() => {
    const fed = federalTax(gross, status);
    return Object.entries(STATE_TAX)
      .map(([code, info]) => {
        const st = stateTax(gross, code);
        const total = fed + st;
        return {
          code,
          name: info.name,
          fedTax: fed,
          stTax: st,
          totalTax: total,
          takeHome: gross - total,
          effRate: gross > 0 ? total / gross : 0,
        };
      })
      .sort((a, b) => a.totalTax - b.totalTax);
  }, [gross, status]);

  const stateOptions = Object.entries(STATE_TAX).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );

  const inputCls =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50';

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="mx-auto max-w-6xl px-6 py-12">

        {/* ── Nav ── */}
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Back to Home
        </Link>

        {/* ── Heading ── */}
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Salary &amp; Tax Calculator
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Estimate your 2026 federal and state income taxes and see take-home pay across
          all 50&nbsp;states + D.C.
        </p>

        {/* ── Calculator Card ── */}
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Inputs */}
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Annual Gross Income
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  className={`${inputCls} pl-7`}
                  placeholder="75000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Filing Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FilingStatus)}
                className={`${inputCls} mt-1`}
              >
                {(Object.keys(FILING_LABELS) as FilingStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {FILING_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                State
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className={`${inputCls} mt-1`}
              >
                {stateOptions.map(([code, info]) => (
                  <option key={code} value={code}>
                    {info.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <ResultCard
              label="Federal Tax"
              value={usd(fedTax)}
              sub={`${pct(gross > 0 ? fedTax / gross : 0)} of gross`}
            />
            <ResultCard
              label="State Tax"
              value={usd(stTax)}
              sub={`${STATE_TAX[selectedState]?.name ?? ''}`}
            />
            <ResultCard
              label="Total Tax"
              value={usd(totalTax)}
              sub={`${pct(effRate)} effective rate`}
              variant="accent"
            />
            <ResultCard
              label="Effective Rate"
              value={pct(effRate)}
              sub="of gross income"
            />
            <ResultCard
              label="Take-Home Pay"
              value={usd(takeHome)}
              sub="annual after income tax"
              variant="green"
            />
          </div>

          {/* State notes */}
          {STATE_TAX[selectedState]?.notes && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              ℹ️ {STATE_TAX[selectedState].notes}
            </p>
          )}
        </section>

        {/* ── All-States Comparison Table ── */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            All-State Income Tax Comparison
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Based on{' '}
            <span className="font-medium">{usd(gross)}</span> gross income,{' '}
            <span className="font-medium">{FILING_LABELS[status]}</span> filing status.
            Sorted by total tax (lowest first). Your selected state is highlighted.
          </p>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    #
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    State
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Federal Tax
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    State Tax
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Total Tax
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Eff. Rate
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Take-Home
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((row, i) => {
                  const isSelected = row.code === selectedState;
                  return (
                    <tr
                      key={row.code}
                      onClick={() => setSelectedState(row.code)}
                      className={`cursor-pointer border-b border-zinc-100 transition-colors last:border-0 dark:border-zinc-800/60 ${
                        isSelected
                          ? 'bg-zinc-100 dark:bg-zinc-800'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <td className="px-4 py-2.5 text-xs text-zinc-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className="mr-2 font-mono text-xs text-zinc-400">{row.code}</span>
                        <span className={`font-medium ${isSelected ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-200'}`}>
                          {row.name}
                        </span>
                        {isSelected && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
                            selected
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-300">
                        {usd(row.fedTax)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-300">
                        {usd(row.stTax)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                        {usd(row.totalTax)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 dark:text-zinc-400">
                        {pct(row.effRate)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {usd(row.takeHome)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Disclaimer */}
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            * Federal brackets are 2026 projections based on IRS Rev.&nbsp;Proc.&nbsp;2024-40 with a ~2.8&nbsp;%
            inflation adjustment (TCJA rates assumed to continue). State rates reflect the most current
            available 2025/2026 information from state revenue departments and Tax Foundation data.
            Estimates only — does not include FICA/payroll taxes, local/city taxes, AMT, deductions beyond
            the standard deduction, or tax credits. Click any row to update the calculator above.
            Consult a qualified tax professional for personalized advice.
          </p>
        </section>
      </div>
    </main>
  );
}
