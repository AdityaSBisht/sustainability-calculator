const REQUIRED_COLUMNS = [
  'id',
  'country',
  'diesel_price_per_gallon',
  'trucker_wage_per_hr',
  'handler_wage_per_hr',
  'carrier_wage_per_hr',
  'forwarder_wage_per_hr',
  'currency_symbol'
]

const NUMERIC_COLUMNS = new Set([
  'id',
  'diesel_price_per_gallon',
  'trucker_wage_per_hr',
  'handler_wage_per_hr',
  'carrier_wage_per_hr',
  'forwarder_wage_per_hr'
])

export const FALLBACK_COUNTRIES = [
  { id: 1, country: 'United States', diesel_price_per_gallon: 4, trucker_wage_per_hr: 37, handler_wage_per_hr: 16, carrier_wage_per_hr: 16, forwarder_wage_per_hr: 33, currency_symbol: '$' },
  { id: 2, country: 'United Kingdom', diesel_price_per_gallon: 7.2, trucker_wage_per_hr: 18, handler_wage_per_hr: 12, carrier_wage_per_hr: 20, forwarder_wage_per_hr: 20, currency_symbol: '£' },
  { id: 3, country: 'India', diesel_price_per_gallon: 1.2, trucker_wage_per_hr: 3.5, handler_wage_per_hr: 2, carrier_wage_per_hr: 4, forwarder_wage_per_hr: 4, currency_symbol: '₹' },
  { id: 4, country: 'UAE', diesel_price_per_gallon: 2.5, trucker_wage_per_hr: 8, handler_wage_per_hr: 5, carrier_wage_per_hr: 10, forwarder_wage_per_hr: 10, currency_symbol: 'AED' },
  { id: 5, country: 'Germany', diesel_price_per_gallon: 7.5, trucker_wage_per_hr: 22, handler_wage_per_hr: 14, carrier_wage_per_hr: 25, forwarder_wage_per_hr: 25, currency_symbol: '€' },
  { id: 6, country: 'Singapore', diesel_price_per_gallon: 5.8, trucker_wage_per_hr: 15, handler_wage_per_hr: 10, carrier_wage_per_hr: 18, forwarder_wage_per_hr: 18, currency_symbol: 'SGD' },
  { id: 7, country: 'Australia', diesel_price_per_gallon: 4.5, trucker_wage_per_hr: 28, handler_wage_per_hr: 18, carrier_wage_per_hr: 30, forwarder_wage_per_hr: 30, currency_symbol: 'AUD' },
  { id: 8, country: 'Canada', diesel_price_per_gallon: 4.2, trucker_wage_per_hr: 25, handler_wage_per_hr: 16, carrier_wage_per_hr: 27, forwarder_wage_per_hr: 27, currency_symbol: 'CAD' },
  { id: 9, country: 'China', diesel_price_per_gallon: 1.5, trucker_wage_per_hr: 6, handler_wage_per_hr: 3.5, carrier_wage_per_hr: 7, forwarder_wage_per_hr: 7, currency_symbol: '¥' },
  { id: 10, country: 'Brazil', diesel_price_per_gallon: 3.2, trucker_wage_per_hr: 5, handler_wage_per_hr: 3, carrier_wage_per_hr: 6, forwarder_wage_per_hr: 6, currency_symbol: 'R$' }
]

function parseCsvRows(csvText) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]
    const nextCharacter = csvText[index + 1]

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export function parseCountryDataCsv(csvText) {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('Country data CSV does not contain any rows.')

  const headers = rows[0].map((header) => header.trim())
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column))
  if (missingColumns.length) {
    throw new Error(`Country data CSV is missing: ${missingColumns.join(', ')}`)
  }

  return rows.slice(1).map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => {
      const value = (values[index] ?? '').trim()
      const parsedValue = NUMERIC_COLUMNS.has(header)
        ? (value === '' ? Number.NaN : Number(value))
        : value
      return [header, parsedValue]
    }))

    const hasInvalidNumber = REQUIRED_COLUMNS.some((column) => (
      NUMERIC_COLUMNS.has(column) && !Number.isFinite(record[column])
    ))

    if (!record.country || !record.currency_symbol || hasInvalidNumber) {
      throw new Error(`Country data CSV has an invalid row for ${record.country || 'an unnamed country'}.`)
    }

    return record
  })
}

export async function loadCountryData() {
  const response = await fetch('/country_data.csv')
  if (!response.ok) throw new Error(`Unable to load country data (${response.status}).`)
  return parseCountryDataCsv(await response.text())
}
