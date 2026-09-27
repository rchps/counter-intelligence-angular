// The Margin Calculator's math and validation. Returns a plain outcome (the numbers, or which fields
// are invalid and why) that the component renders; nothing here touches the page.
//   price  = cost / (1 - margin)       margin = (price - cost) / price
//   cost   = price x (1 - margin)      markup = (price - cost) / cost

export type MarginMode = 'cost-margin' | 'cost-price' | 'price-margin';
export type MarginField = 'cost' | 'price' | 'margin';

export const INPUTS_FOR_MODE: Record<MarginMode, MarginField[]> = {
  'cost-margin': ['cost', 'margin'],
  'cost-price': ['cost', 'price'],
  'price-margin': ['price', 'margin'],
};

export interface MarginRawInputs {
  cost: string;
  price: string;
  margin: string;
}

export interface MarginSuccess {
  status: 'ok';
  cost: number;
  price: number;
  profit: number;
  margin: number;
  markup: number | null; // null (shown as "n/a") when cost is 0
  belowCost: boolean;
  message: string; // '' unless belowCost ("Selling below cost.")
}

export interface MarginInvalid {
  status: 'invalid';
  message: string;
  invalidFields: MarginField[];
}

export interface MarginIncomplete {
  status: 'incomplete';
}

export type MarginOutcome = MarginSuccess | MarginInvalid | MarginIncomplete;

// "$1,234.50" -> 1234.5; blank -> NaN. Differs from sales-math.ts's parseMoney (which returns null for
// blank): calculateMargin needs to tell "blank" and "not a number" apart per field, and also accepts a
// trailing "%" since the same reader handles the margin box.
export function parseMarginNumber(text: string): number {
  const cleaned = text.replace(/[$,%\s]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

export function calculateMargin(mode: MarginMode, raw: MarginRawInputs): MarginOutcome {
  const needed = INPUTS_FOR_MODE[mode];
  const values: Record<MarginField, number> = {
    cost: parseMarginNumber(raw.cost),
    price: parseMarginNumber(raw.price),
    margin: parseMarginNumber(raw.margin),
  };

  // 1. Something typed that isn't a number
  const notANumber = needed.find((name) => raw[name].trim() !== '' && !isFinite(values[name]));
  if (notANumber) {
    return {
      status: 'invalid',
      invalidFields: [notANumber],
      message: "That doesn't look like a number. Use digits only, like 1250.50.",
    };
  }

  // 2. Not both boxes filled in yet
  if (needed.some((name) => !isFinite(values[name]))) return { status: 'incomplete' };

  // 3. Values that can't work
  if (needed.includes('margin') && values.margin >= 100) {
    return {
      status: 'invalid',
      invalidFields: ['margin'],
      message: "Margin has to be under 100%. We'd all like 100% margin, though.",
    };
  }
  const negatives = needed.filter((name) => values[name] < 0);
  if (negatives.length) {
    const onlyCost = negatives.length === 1 && negatives[0] === 'cost';
    return {
      status: 'invalid',
      invalidFields: negatives,
      message: onlyCost
        ? "Cost can't be negative. (If it is, tell me who your vendor is.)"
        : "Values can't be negative.",
    };
  }

  // 4. Work out the missing value
  let { cost, price, margin } = values;
  if (mode === 'cost-margin') {
    price = cost / (1 - margin / 100);
  } else if (mode === 'cost-price') {
    if (price === 0) {
      return {
        status: 'invalid',
        invalidFields: ['price'],
        message: "Selling price can't be zero.",
      };
    }
    margin = ((price - cost) / price) * 100;
  } else {
    cost = price * (1 - margin / 100);
  }
  const profit = price - cost;
  const markup = cost > 0 ? (profit / cost) * 100 : null;
  const belowCost = profit < 0;

  return {
    status: 'ok',
    cost,
    price,
    profit,
    margin,
    markup,
    belowCost,
    message: belowCost ? 'Selling below cost.' : '',
  };
}

export function formatPercent(value: number): string {
  return value.toFixed(2) + '%';
}
