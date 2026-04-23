# Market Rates Workflow

## Why Homewyse appeared blocked

Some source sites render extra content behind interactive pages. The pricing pipeline in this repo does not depend on clicking those pages in the browser; it reads structured observations from local data files.

## Current data flow

1. Maintain public-web observations in `data/market_labor_observations.json`.
2. Add licensed RSMeans rows to `data/rsmeans_raw.csv` (copy from template first).
3. Import RSMeans rows into normalized JSON.
4. Build weighted labor targets.
5. Run migrations to apply updates to `Pricebook_Master`.

## Files

- `data/market_labor_observations.json`: public web observations.
- `data/rsmeans_raw.template.csv`: template for RSMeans export mapping.
- `data/rsmeans_raw.csv`: your private RSMeans import file (create locally).
- `data/rsmeans_observations.json`: normalized RSMeans observations produced by script.
- `data/market_labor_targets.json`: computed target costs used by migration.

## Commands

```bash
npm run import:rsmeans
npm run build:market-rates
npm run apply:market-rates
npm run migrate
```

`apply:market-rates` lets you re-apply computed targets without creating a new migration, which is useful as soon as you refresh RSMeans inputs.

## RSMeans CSV columns

Required columns in `rsmeans_raw.csv`:

- `item_code`
- `unit`
- `labor_unit_cost_low`
- `labor_unit_cost_high`

Recommended columns:

- `source_name`
- `source_url`
- `source_date`
- `notes`
- `labor_rate_ref`

RSMeans rows are currently weighted higher than public web rows in target calculations.
