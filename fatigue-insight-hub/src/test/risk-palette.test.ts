import { describe, expect, it } from 'vitest';
import { classifyKss, riskClasses, riskCssColor, riskInkColor, roundKss, RISK_LEVELS } from '@/lib/risk-scale';

// Vitest stubs CSS imports, so read the stylesheet from disk (Node built-in, untyped in the app tsconfig).
const fsModule = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (p: string, enc: string) => string };
const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
const css = readFileSync(`${cwd}/src/index.css`, 'utf8');

/** Read the custom properties of one theme block ("  :root {" or "  .light {") from index.css. */
function themeTokens(selector: string): Record<string, string> {
  const start = css.indexOf(`  ${selector} {`);
  const block = css.slice(start, css.indexOf('\n  }', start));
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
  return tokens;
}

function hslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.split(/\s+/).map(parseFloat);
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function contrast(a: string, b: string): number {
  const lum = (rgb: [number, number, number]) => {
    const [r, g, bl] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(hslToRgb(a)), lum(hslToRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('risk palette tokens', () => {
  const light = { ...themeTokens(':root'), ...themeTokens('.light') };
  const themes = { dark: themeTokens(':root'), light };

  for (const [name, tokens] of Object.entries(themes)) {
    describe(`${name} theme`, () => {
      it.each(RISK_LEVELS)('%s fill, ink and on-fill text meet WCAG AA', (level) => {
        const card = tokens.card;
        expect(contrast(tokens[`risk-${level}`], card), 'fill vs card').toBeGreaterThanOrEqual(3);
        expect(contrast(tokens[`risk-${level}-ink`], card), 'ink vs card').toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens[`risk-${level}-on`], tokens[`risk-${level}`]), 'text on fill').toBeGreaterThanOrEqual(4.5);
      });

      it('keeps body and muted text readable, and borders visible', () => {
        expect(contrast(tokens['muted-foreground'], tokens.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens['muted-foreground'], tokens.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens.primary, tokens.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens.border, tokens.card)).toBeGreaterThanOrEqual(1.4);
      });

      it('keeps legacy semantic text tokens at 4.5:1 on cards', () => {
        for (const t of ['warning', 'high', 'critical']) {
          expect(contrast(tokens[t], tokens.card), t).toBeGreaterThanOrEqual(4.5);
        }
      });
    });
  }

  it('gives every band its own fill so the key never shows two bands in one colour', () => {
    for (const tokens of Object.values(themes)) {
      const fills = RISK_LEVELS.map((l) => tokens[`risk-${l}`]);
      expect(new Set(fills).size).toBe(RISK_LEVELS.length);
    }
  });

  it('exposes the palette through theme variables only', () => {
    for (const level of RISK_LEVELS) {
      expect(riskCssColor(level)).toBe(`hsl(var(--risk-${level}))`);
      expect(riskInkColor(level)).toBe(`hsl(var(--risk-${level}-ink))`);
      expect(riskClasses(level).fill).toBe(`bg-risk-${level}`);
      expect(riskClasses(level).text).toBe(`text-risk-${level}-ink`);
    }
    expect(riskCssColor('high', 0.2)).toBe('hsl(var(--risk-high) / 0.2)');
  });
});

describe('KSS band classification', () => {
  it('classifies the value as displayed (one decimal), lower bound inclusive', () => {
    expect(classifyKss(5.44)).toBe('low');
    expect(classifyKss(5.46)).toBe('moderate'); // shows 5.5
    expect(classifyKss(6.45)).toBe('high'); // shows 6.5
    expect(classifyKss(6.44)).toBe('moderate');
    expect(classifyKss(7.5)).toBe('critical');
    expect(classifyKss(8.46)).toBe('extreme'); // shows 8.5
    expect(classifyKss(null)).toBe('unknown');
    expect(roundKss(6.46)).toBe(6.5);
    // Displayed digits and band always agree, including binary edge cases.
    for (const k of [5.45, 5.55, 6.45, 6.55, 7.45, 7.55, 8.45, 8.55]) {
      expect(classifyKss(k)).toBe(classifyKss(Number(k.toFixed(1))));
    }
  });
});
