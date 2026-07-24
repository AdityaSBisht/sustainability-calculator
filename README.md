# Airport Cargo Savings Calculator

A Kale Logistics Solutions calculator for estimating airport cargo operating savings and CO2 impact across trucker, freight-forwarder, airport, and ground-handler scenarios.

## Getting started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Country data

Country-specific diesel prices, wages, and currency symbols are stored in [`public/country_data.csv`](public/country_data.csv). The browser loads that file directly; Supabase credentials are not required.

Keep these columns when replacing the CSV with a new export:

- `id`
- `country`
- `diesel_price_per_gallon`
- `trucker_wage_per_hr`
- `handler_wage_per_hr`
- `carrier_wage_per_hr`
- `forwarder_wage_per_hr`
- `currency_symbol`

## Validation

```bash
npm run lint
npm run build
```
