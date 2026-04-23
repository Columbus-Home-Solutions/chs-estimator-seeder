# Jobber Products & Services Sync

This project exports `Pricebook_Master` into a Jobber-compatible CSV for bulk import/update.

## Fixed mapping (as requested)

- Item Category in Jobber: `Service` for every row
- Jobber `Unit cost`: from `base_unit_cost`
- Jobber `Unit Price`: from `final_unit_cost`

Additional mapping:

- `Name` = `item_code`
- `Description` = `description`
- `Taxable` = (`taxable` is `Y`)
- `Active` = (`status` is not `Retired`)

## Export command

```bash
npm run export:jobber-csv
```

Output file:

- `data/jobber_products_services.csv`

## Import into Jobber

1. In Jobber go to `Settings > Products & Services`.
2. Open `Import Products & Services`.
3. Upload `data/jobber_products_services.csv`.
4. Check `Update existing items` so existing items are updated (not duplicated).

## Notes

- Keep `item_code` stable so updates target the correct existing Jobber item.
- Numeric columns are exported with 2 decimal places.
