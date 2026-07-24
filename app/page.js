'use client'

import { useEffect, useRef, useState } from 'react'
import { FALLBACK_COUNTRIES, loadCountryData } from '../lib/country-data'
import { calculateSimple, calculateForwarder, calculateAirport, calculateGHA } from '../utils/calculator'

const ENTITY_OPTIONS = [
  {
    id: 'trucker',
    label: 'Trucker',
    kicker: 'Fleet movement',
    description: 'Trips, miles, fuel, labor, idling, paperwork, and penalty exposure.'
  },
  {
    id: 'forwarder',
    label: 'Freight forwarder',
    kicker: 'Document flow',
    description: 'Shipment paperwork and delay exposure across the forwarding desk.'
  },
  {
    id: 'airport',
    label: 'Airport',
    kicker: 'Cargo zone',
    description: 'Truck volume, turnaround, and congestion pressure around the cargo estate.'
  },
  {
    id: 'gha',
    label: 'Ground handler',
    kicker: 'Dock operations',
    description: 'AWB handling, gate staffing, and truck wait time before docking.'
  }
]

const INPUTS = {
  trucker: [
    ['trucks', 'Number of trucks in fleet', 'Total active trucks serving airport cargo.'],
    ['tripsPerMonth', 'Airport trips per truck per month', 'Average monthly airport runs per truck.'],
    ['roundTripDistanceMiles', 'Round-trip distance to terminal', 'Both directions, measured in miles.'],
    ['hourlyWage', 'Average driver hourly wage', 'Pre-filled from the selected market.', 'currency'],
    ['dieselPrice', 'Diesel price per gallon', 'Pre-filled from the selected market.', 'currency', 0.01],
    ['mpg', 'Truck fuel efficiency', 'Typical diesel truck range is 6 to 8 mpg.', '', 0.1],
    ['idleMinutesPerTrip', 'Average idle time at gate', 'Minutes per trip waiting or queueing.']
  ],
  forwarder: [
    ['shipmentsPerMonth', 'Shipments per month', 'Total monthly forwarding volume.'],
    ['paperworkTimeMins', 'Paperwork time per shipment', 'Manual entry, checking, and corrections.'],
    ['hourlyWage', 'Average admin hourly wage', 'Pre-filled from the selected market.', 'currency'],
    ['slaPenaltyMonthly', 'Average SLA penalties per month', 'Penalty exposure from missed flights or delays.', 'currency']
  ],
  airport: [
    ['dailyTrucks', 'Daily truck volume', 'Trucks entering the cargo zone each day.'],
    ['turnaroundTimeMins', 'Average truck turnaround time', 'Minutes from entry to exit.'],
    ['congestionCostMonthly', 'Monthly congestion costs', 'Traffic management and infrastructure pressure.', 'currency']
  ],
  gha: [
    ['monthlyAWBs', 'Monthly AWBs handled', 'Total airway bills handled per month.'],
    ['gateStaff', 'Number of gate staff', 'Staff dedicated to truck check-in.'],
    ['hourlyWage', 'Gate staff hourly wage', 'Pre-filled from the selected market.', 'currency'],
    ['waitMinsPerTruck', 'Average truck wait time', 'Minutes before docking.']
  ]
}

const INITIAL_INPUTS = {
  trucker: {
    trucks: 12,
    tripsPerMonth: 45,
    roundTripDistanceMiles: 30,
    mpg: 6.5,
    idleMinutesPerTrip: 55
  },
  forwarder: {},
  airport: {},
  gha: {}
}

const BENCHMARK_ASSUMPTIONS = {
  trucker: {
    fuelReduction: 18,
    timeReduction: 65,
    complianceReduction: 75,
    maintenanceReduction: 18
  },
  forwarder: {
    fuelReduction: 0,
    timeReduction: 65,
    complianceReduction: 80,
    maintenanceReduction: 0
  },
  airport: {
    fuelReduction: 0,
    timeReduction: 40,
    complianceReduction: 70,
    maintenanceReduction: 0
  },
  gha: {
    fuelReduction: 50,
    timeReduction: 30,
    complianceReduction: 0,
    maintenanceReduction: 0
  }
}

const ASSUMPTION_CONTROLS = {
  trucker: [
    ['fuelReduction', 'Fuel reduction', 'Fuel spend avoided through lower idle and route waste.'],
    ['timeReduction', 'Time and labor reduction', 'Driver wait time and paperwork labor avoided.'],
    ['complianceReduction', 'Penalty exposure reduction', 'Regulatory and exception exposure avoided.'],
    ['maintenanceReduction', 'Mileage / maintenance reduction', 'Avoided miles multiplied by maintenance cost.']
  ],
  forwarder: [
    ['timeReduction', 'Paperwork reduction', 'Manual document handling avoided.'],
    ['complianceReduction', 'SLA exposure reduction', 'Delay and missed-service exposure avoided.']
  ],
  airport: [
    ['timeReduction', 'Turnaround reduction', 'Cargo-zone truck cycle time avoided.'],
    ['complianceReduction', 'Congestion reduction', 'Traffic management and estate pressure avoided.']
  ],
  gha: [
    ['fuelReduction', 'Wait-time reduction', 'Truck waiting time before docking avoided.'],
    ['timeReduction', 'Gate labor efficiency', 'Staffing effort saved at the gate.']
  ]
}

const SAVINGS_ROWS = [
  { key: 'fuelSavings', label: 'Fuel savings', assumption: 'fuelReduction', chip: 'decrease' },
  { key: 'driverTimeSavings', label: 'Time and labor savings', assumption: 'timeReduction', chip: 'reduction' },
  { key: 'complianceSavings', label: 'Compliance savings', assumption: 'complianceReduction', chip: 'lower exposure' },
  { key: 'maintenanceSavings', label: 'Maintenance savings', assumption: 'maintenanceReduction', chip: 'efficiency gain' }
]

function BrandLogo() {
  return (
    <div className="brand-mark" aria-label="Kale Logistics Solutions">
      <img src="/kale-logo.png" alt="Kale Logistics Solutions" />
    </div>
  )
}

function getCurrencyPrefix(currency) {
  if (!currency) return '$'
  return currency.length > 1 ? `${currency} ` : currency
}

function formatCurrency(value, currency) {
  return `${getCurrencyPrefix(currency)}${Math.round(value || 0).toLocaleString()}`
}

function formatNumber(value) {
  return Math.round(value || 0).toLocaleString()
}

function sanitizeCurrencyForPdf(currency) {
  if (currency === '₹') return 'Rs. '
  if (currency === 'د.إ') return 'AED '
  if (currency && currency.length === 1 && currency.charCodeAt(0) > 127) return ''
  return getCurrencyPrefix(currency)
}

function calculateForEntity(entity, inputValues, assumptions) {
  if (entity === 'trucker') return calculateSimple(inputValues, assumptions)
  if (entity === 'forwarder') return calculateForwarder(inputValues, assumptions)
  if (entity === 'airport') return calculateAirport(inputValues, assumptions)
  if (entity === 'gha') return calculateGHA(inputValues, assumptions)
  return null
}

function clampPercentage(value) {
  const number = Number(value)
  if (Number.isNaN(number)) return 0
  return Math.min(100, Math.max(0, Math.round(number)))
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || !target) {
      const frame = requestAnimationFrame(() => setValue(target || 0))
      return () => cancelAnimationFrame(frame)
    }

    let start = 0
    const steps = 42
    const increment = target / steps
    const interval = duration / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setValue(target)
        clearInterval(timer)
      } else {
        setValue(Math.floor(start))
      }
    }, interval)

    return () => clearInterval(timer)
  }, [duration, target])

  return value
}

function useScrollReveal(enabled, key) {
  useEffect(() => {
    if (!enabled) return

    const nodes = Array.from(document.querySelectorAll('.motion-reveal'))
    if (!nodes.length) return

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.18
    })

    nodes.forEach((node, index) => {
      node.style.setProperty('--reveal-order', index % 6)
      observer.observe(node)
    })

    return () => observer.disconnect()
  }, [enabled, key])
}

async function generatePDF({ results, activeEntity, selectedCountry, currency }) {
  const jsPDFModule = await import('jspdf/dist/jspdf.es.min.js')
  const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const c = sanitizeCurrencyForPdf(currency)
  let y = 58

  const write = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts)
  const divider = (yy) => {
    doc.setDrawColor(169, 139, 79)
    doc.line(14, yy, pageWidth - 14, yy)
  }
  const section = (label, yy) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(47, 93, 78)
    write(label, 14, yy)
    divider(yy + 4)
    return yy + 14
  }
  const row = (label, value, yy, muted = false) => {
    doc.setFillColor(247, 243, 235)
    doc.setDrawColor(224, 215, 199)
    doc.roundedRect(14, yy - 7, pageWidth - 28, 14, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(80, 68, 58)
    write(label, 18, yy + 2)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(muted ? [80, 68, 58] : [47, 93, 78]))
    write(value, pageWidth - 18, yy + 2, { align: 'right' })
    return yy + 16
  }

  doc.setFillColor(236, 230, 218)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
  doc.setFillColor(27, 23, 20)
  doc.rect(0, 0, pageWidth, 44, 'F')
  doc.setTextColor(236, 230, 218)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  write('Airport Cargo Savings Report', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  write('ACS Airport Community Systems', 14, 28)
  doc.setTextColor(169, 139, 79)
  write(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 14, 36)
  doc.setTextColor(236, 230, 218)
  doc.setFont('helvetica', 'bold')
  write(selectedCountry, pageWidth - 14, 18, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  write(`Entity: ${activeEntity.toUpperCase()}`, pageWidth - 14, 32, { align: 'right' })

  y = section('Current monthly baseline', y)
  y = row('Total monthly trips', formatNumber(results.totalMonthlyTrips), y, true)
  y = row('Total monthly miles driven', formatNumber(results.totalMonthlyMiles), y, true)
  y = row('Monthly fuel cost', `${c}${formatNumber(results.monthlyFuelCost)}`, y, true)
  y = row('Monthly labor - trips', `${c}${formatNumber(results.driverLabourTrips)}`, y, true)
  y = row('Idle / gate-queue cost', `${c}${formatNumber(results.idleGateCost)}`, y, true)
  y = row('Paperwork labor cost', `${c}${formatNumber(results.paperworkLabour)}`, y, true)
  y = row('Regulatory penalty exposure', `${c}${formatNumber(results.regulatoryPenalty)}`, y, true)

  y += 8
  doc.setFillColor(47, 93, 78)
  doc.roundedRect(14, y, pageWidth - 28, 30, 2, 2, 'F')
  doc.setTextColor(236, 230, 218)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  write('Estimated savings with digital ACS', pageWidth / 2, y + 10, { align: 'center' })
  doc.setFontSize(22)
  write(`${c}${formatNumber(results.totalMonthlySavings)} / month`, pageWidth / 2, y + 22, { align: 'center' })
  y += 42

  y = section('Savings breakdown', y)
  y = row('Fuel savings', `${c}${formatNumber(results.fuelSavings)}`, y)
  y = row('Time and labor savings', `${c}${formatNumber(results.driverTimeSavings)}`, y)
  y = row('Compliance savings', `${c}${formatNumber(results.complianceSavings)}`, y)
  y = row('Maintenance savings', `${c}${formatNumber(results.maintenanceSavings)}`, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 68, 58)
  write(`Annual savings projected: ${c}${formatNumber(results.totalAnnualSavings)}`, 14, pageHeight - 26)
  write(`Annual CO2 reduction: ${results.co2TonsYear.toLocaleString()} metric tons`, 14, pageHeight - 18)
  write('For informational purposes based on industry benchmarks. Actual savings may vary.', 14, pageHeight - 10)

  doc.save(`ACS_Savings_Report_${selectedCountry.replace(/ /g, '_')}_${new Date().getFullYear()}.pdf`)
}

function InputField({ field, label, hint, value, onChange, currency, kind = '', step = 1 }) {
  const id = `input-${field}`
  const prefix = kind === 'currency' ? getCurrencyPrefix(currency) : ''

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <p className="field__hint">{hint}</p>
      <div className="field__control">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          id={id}
          type="number"
          min="0"
          step={step}
          value={value == null || value === '' ? '' : value}
          placeholder="0"
          onKeyDown={(event) => {
            if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault()
          }}
          onChange={(event) => {
            if (event.target.value === '') {
              onChange('')
              return
            }
            const number = Number(event.target.value)
            onChange(number < 0 ? 0 : number)
          }}
        />
      </div>
    </div>
  )
}

function EntityButton({ entity, active, onClick }) {
  return (
    <button
      type="button"
      className={`entity-button ${active ? 'entity-button--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{entity.kicker}</span>
      {entity.label}
    </button>
  )
}

function MetricCard({ label, value, unit = '', currency, isCurrency = false, tone = 'neutral', chip = '', className = '' }) {
  const animated = useCountUp(Number(value) || 0)
  const display = isCurrency ? formatCurrency(animated, currency) : `${formatNumber(animated)}${unit ? ` ${unit}` : ''}`

  return (
    <article className={`metric-card metric-card--${tone} ${className}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        {chip && <span className="metric-card__chip">{chip}</span>}
      </div>
      <strong className="metric-card__value">{display}</strong>
    </article>
  )
}

function SavingsValue({ value, currency }) {
  const animated = useCountUp(Number(value) || 0, 1100)

  return <>{formatCurrency(animated, currency)}</>
}

function AssumptionControl({ control, value, benchmark, onChange }) {
  const [key, label, description] = control
  const controlId = `assumption-${key}`

  return (
    <label className="assumption-control" htmlFor={controlId}>
      <span className="assumption-control__header">
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
        <b>{value}%</b>
      </span>
      <input
        id={controlId}
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onInput={(event) => onChange(key, event.currentTarget.value)}
        onChange={(event) => onChange(key, event.target.value)}
      />
      <span className="assumption-control__footer">
        <span>0%</span>
        <span>Benchmark {benchmark}%</span>
        <span>100%</span>
      </span>
    </label>
  )
}

export default function Home() {
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [countryData, setCountryData] = useState(null)
  const [activeEntity, setActiveEntity] = useState('trucker')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showCalculator, setShowCalculator] = useState(true)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [changedAssumption, setChangedAssumption] = useState('')
  const [assumptions, setAssumptions] = useState(BENCHMARK_ASSUMPTIONS)
  const [contactDetails, setContactDetails] = useState({
    name: '',
    company: '',
    email: ''
  })
  const [inputs, setInputs] = useState(INITIAL_INPUTS)
  const resultsRef = useRef(null)
  const assumptionPulseTimer = useRef(null)

  const currency = countryData?.currency_symbol || '$'
  const activeMeta = ENTITY_OPTIONS.find((entity) => entity.id === activeEntity)
  const activeInputs = inputs[activeEntity] || {}
  const activeFields = INPUTS[activeEntity]
  const activeAssumptions = assumptions[activeEntity] || BENCHMARK_ASSUMPTIONS[activeEntity]
  const activeAssumptionControls = ASSUMPTION_CONTROLS[activeEntity] || []
  const hasResults = Boolean(results)

  useEffect(() => {
    let active = true
    loadCountryData()
      .then((data) => {
        if (active && data.length) setCountries(data)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (assumptionPulseTimer.current) clearTimeout(assumptionPulseTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!selectedCountry) return

    const market = countries.find((country) => country.country === selectedCountry)
      || FALLBACK_COUNTRIES.find((country) => country.country === selectedCountry)
    const applyMarket = (market) => {
      if (!market) return
      setCountryData(market)
      setInputs((previous) => ({
        ...previous,
        trucker: {
          ...previous.trucker,
          hourlyWage: market.trucker_wage_per_hr,
          dieselPrice: market.diesel_price_per_gallon
        },
        forwarder: {
          ...previous.forwarder,
          hourlyWage: market.forwarder_wage_per_hr
        },
        gha: {
          ...previous.gha,
          hourlyWage: market.handler_wage_per_hr
        }
      }))
    }

    applyMarket(market)
  }, [countries, selectedCountry])

  useEffect(() => {
    if (!hasResults) return
    const frame = requestAnimationFrame(() => {
      setResults(calculateForEntity(activeEntity, activeInputs, activeAssumptions))
    })
    return () => cancelAnimationFrame(frame)
  }, [activeAssumptions, activeEntity, activeInputs, hasResults])

  useScrollReveal(Boolean(results), `${activeEntity}-${selectedCountry}-${results?.totalMonthlySavings || 0}`)

  function updateInput(field, value) {
    setInputs((previous) => ({
      ...previous,
      [activeEntity]: {
        ...previous[activeEntity],
        [field]: value
      }
    }))
  }

  function canCalculate() {
    if (!selectedCountry) return false
    return INPUTS[activeEntity].every(([field]) => Number(activeInputs[field]) > 0)
  }

  function handleEntityChange(entityId) {
    setActiveEntity(entityId)
    setResults(null)
    setShowAssumptions(false)
    setChangedAssumption('')
  }

  function markAssumptionChange(key) {
    setChangedAssumption(key)
    if (assumptionPulseTimer.current) clearTimeout(assumptionPulseTimer.current)
    assumptionPulseTimer.current = setTimeout(() => setChangedAssumption(''), 760)
  }

  function updateAssumption(key, value) {
    const nextValue = clampPercentage(value)

    setAssumptions((previous) => ({
      ...previous,
      [activeEntity]: {
        ...previous[activeEntity],
        [key]: nextValue
      }
    }))
    if (results) markAssumptionChange(key)
  }

  function resetActiveAssumptions() {
    setAssumptions((previous) => ({
      ...previous,
      [activeEntity]: { ...BENCHMARK_ASSUMPTIONS[activeEntity] }
    }))
    if (results) markAssumptionChange('all')
  }

  function handleCalculate() {
    if (!canCalculate()) return

    setLoading(true)
    setResults(null)
    setShowAssumptions(false)
    setTimeout(() => {
      const calculated = calculateForEntity(activeEntity, activeInputs, activeAssumptions)

      setResults(calculated)
      setShowCalculator(false)
      setLoading(false)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }, 680)
  }

  async function handleDownload() {
    if (!results) return
    setDownloading(true)
    await generatePDF({ results, activeEntity, selectedCountry, currency })
    setDownloading(false)
  }

  return (
    <main className="app-shell">
      {!results && (
        <section className={`landing-stage ${showCalculator ? 'landing-stage--dimmed' : ''}`}>
          <header className="site-nav" aria-label="Site navigation">
            <BrandLogo />
            <nav>
              <a href="#solutions">Solutions</a>
              <a href="#about">About us</a>
              <a href="#careers">Careers</a>
              <a href="#contact">Contact</a>
            </nav>
          </header>

          <div className="landing-copy">
            <p className="eyebrow">ACS savings calculator</p>
            <h1>Estimate the operational drag hiding inside airport trucking.</h1>
            <p className="hero__lede">
              A fast, directional calculator for cargo teams that need to quantify delay,
              fuel burn, paperwork labor, and compliance exposure before the business case.
            </p>
            <button type="button" className="open-calculator" onClick={() => setShowCalculator(true)}>
              Open calculator
            </button>
          </div>

          <div className="landing-footer">
            <div>
              <p className="panel-kicker">About ACS</p>
              <p>
                Kale Logistics Solutions connects airport cargo stakeholders with digital workflows
                that reduce idle time, queue friction, and manual documentation.
              </p>
            </div>
            <div>
              <p className="panel-kicker">Latest story</p>
              <p>Community systems are becoming the operating layer for faster cargo movement.</p>
            </div>
            <div>
              <p className="panel-kicker">Region</p>
              <p>North America</p>
            </div>
          </div>
        </section>
      )}

      {showCalculator && (
        <section
          className={`modal-layer ${loading ? 'modal-layer--calculating' : ''}`}
          role="presentation"
        >
          <div
            className={`calculator-modal ${loading ? 'calculator-modal--calculating' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calculator-title"
          >
              <div className="modal-heading">
                <div>
                  <p className="panel-kicker">Airport trucking</p>
                  <h2 id="calculator-title">Savings calculator</h2>
                  <p>{activeMeta.description}</p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowCalculator(false)}
                  aria-label="Close calculator"
                >
                  ×
                </button>
              </div>

              <div className="modal-grid modal-grid--top">
                <div className="market-row">
                  <label htmlFor="country-select">Market</label>
                  <select
                    id="country-select"
                    value={selectedCountry}
                    onChange={(event) => {
                      const nextCountry = event.target.value
                      setSelectedCountry(nextCountry)
                      setCountryData(null)
                      setResults(null)
                    }}
                  >
                    <option value="">Select a country</option>
                    {countries.map((country) => (
                      <option key={country.country} value={country.country}>{country.country}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-help-card">
                  <span>Output</span>
                  <strong>Monthly and annual savings model</strong>
                </div>
              </div>

              <div className="entity-grid entity-grid--modal" role="group" aria-label="Business entity">
                {ENTITY_OPTIONS.map((entity) => (
                  <EntityButton
                    key={entity.id}
                    entity={entity}
                    active={activeEntity === entity.id}
                    onClick={() => handleEntityChange(entity.id)}
                  />
                ))}
              </div>

              <div className="field-grid field-grid--modal">
                {activeFields.map(([field, label, hint, kind, step]) => (
                  <InputField
                    key={field}
                    field={field}
                    label={label}
                    hint={hint}
                    value={activeInputs[field]}
                    onChange={(value) => updateInput(field, value)}
                    currency={currency}
                    kind={kind}
                    step={step || 1}
                  />
                ))}
              </div>

              <div className="contact-strip">
                <p className="panel-kicker">Optional report details</p>
                <div className="contact-grid">
                  <label>
                    <span>Your name</span>
                    <input
                      type="text"
                      value={contactDetails.name}
                      onChange={(event) => setContactDetails((previous) => ({ ...previous, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Company name</span>
                    <input
                      type="text"
                      value={contactDetails.company}
                      onChange={(event) => setContactDetails((previous) => ({ ...previous, company: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={contactDetails.email}
                      onChange={(event) => setContactDetails((previous) => ({ ...previous, email: event.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <p>{selectedCountry ? `${activeMeta.label} estimate for ${selectedCountry}` : 'Select a market to activate the estimate.'}</p>
                <button
                  type="button"
                  className={`primary-action ${loading ? 'primary-action--calculating' : ''}`}
                  onClick={handleCalculate}
                  disabled={!canCalculate() || loading}
                >
                  {loading ? 'Calculating' : 'Calculate savings'}
                  {loading && (
                    <span className="calculate-progress" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </button>
              </div>
          </div>
        </section>
      )}

      {results && (
        <div
          ref={resultsRef}
          className="results-page"
        >
            <header className="result-nav">
              <BrandLogo />
              <div className="result-actions">
                <button
                  type="button"
                  className="secondary-action secondary-action--light"
                  onClick={() => {
                    setShowAssumptions(false)
                    setShowCalculator(true)
                  }}
                >
                  New estimate
                </button>
                <button
                  type="button"
                  className="secondary-action secondary-action--light"
                  onClick={() => setShowAssumptions(true)}
                >
                  Adjust assumptions
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? 'Preparing report' : 'Download report'}
                </button>
              </div>
            </header>

            <section className="results">
              <div className="results-hero motion-reveal motion-reveal--hero">
                <div className="results-hero__summary">
                  <div className={`hero-savings-card hero-savings-card--primary ${changedAssumption ? 'is-updating' : ''}`}>
                    <span>Monthly savings</span>
                    <strong>
                      <SavingsValue value={results.totalMonthlySavings} currency={currency} />
                    </strong>
                    <p>with digital ACS workflow</p>
                  </div>
                  <div className={`hero-savings-card ${changedAssumption ? 'is-updating' : ''}`}>
                    <span>Annual savings</span>
                    <strong>
                      <SavingsValue value={results.totalAnnualSavings} currency={currency} />
                    </strong>
                    <p>projected over 12 months</p>
                  </div>
                </div>
                <div className="results-hero__meta">
                  <span>{activeMeta.label} - {selectedCountry}</span>
                  <span>Benchmark assumptions active</span>
                </div>
              </div>

              <div className="results-section results-section--savings">
                <div className="section-heading motion-reveal">
                  <div>
                    <p className="panel-kicker">Savings breakdown</p>
                    <h3>Where the savings come from.</h3>
                  </div>
                  <button
                    type="button"
                    className="secondary-action secondary-action--light"
                    onClick={() => setShowAssumptions(true)}
                  >
                    Adjust assumptions
                  </button>
                </div>

                <div className="metric-grid">
                {SAVINGS_ROWS.map((row) => {
                  const percent = activeAssumptions[row.assumption] || 0

                  return (
                    <MetricCard
                      key={row.key}
                      label={row.label}
                      value={results[row.key]}
                      currency={currency}
                      isCurrency
                      tone={row.key === 'fuelSavings' ? 'gold' : row.key === 'complianceSavings' ? 'plum' : 'neutral'}
                      chip={percent > 0 ? `${percent}% ${row.chip}` : ''}
                      className={`motion-reveal motion-reveal--card ${changedAssumption === row.assumption || changedAssumption === 'all' ? 'metric-card--updating' : ''}`}
                    />
                  )
                })}
                </div>
              </div>

              <div className="results-section results-section--baseline">
                <div className="section-heading motion-reveal">
                  <div>
                    <p className="panel-kicker">Model inputs used</p>
                    <h3>Current monthly baseline.</h3>
                  </div>
                  <span>{activeMeta.label} - {selectedCountry}</span>
                </div>

                <div className="metric-grid metric-grid--baseline">
                  <MetricCard label="Monthly trips" value={results.totalMonthlyTrips} className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Monthly miles" value={results.totalMonthlyMiles} className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Fuel cost" value={results.monthlyFuelCost} currency={currency} isCurrency tone="gold" className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Labor - trips" value={results.driverLabourTrips} currency={currency} isCurrency className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Idle / gate queue" value={results.idleGateCost} currency={currency} isCurrency className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Paperwork labor" value={results.paperworkLabour} currency={currency} isCurrency className="motion-reveal motion-reveal--card" />
                  <MetricCard label="Penalty exposure" value={results.regulatoryPenalty} currency={currency} isCurrency className="motion-reveal motion-reveal--card" />
                </div>
              </div>

              <div className="method-note">
                <p className="panel-kicker">Benchmark basis</p>
                <p>
                  Fuel, labor, compliance, and maintenance assumptions reference Kale CCS logic and public industry benchmarks.
                  Use this as a directional estimate, not a guaranteed outcome.
                </p>
              </div>
            </section>
        </div>
      )}

      {results && showAssumptions && (
        <section
          className="assumption-layer"
          role="presentation"
          onClick={() => setShowAssumptions(false)}
        >
          <aside
            className="assumption-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assumption-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assumption-drawer__header">
              <div>
                <p className="panel-kicker">Savings assumptions</p>
                <h2 id="assumption-title">Tune the model.</h2>
                <p>{activeMeta.label} assumptions update the result live.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAssumptions(false)}
                aria-label="Close assumptions"
              >
                ×
              </button>
            </div>

            <div className="assumption-summary">
              <span>Total monthly savings</span>
              <strong>{formatCurrency(results.totalMonthlySavings, currency)}</strong>
            </div>

            <div className="assumption-controls">
              {activeAssumptionControls.map((control) => (
                <AssumptionControl
                  key={control[0]}
                  control={control}
                  value={activeAssumptions[control[0]] || 0}
                  benchmark={BENCHMARK_ASSUMPTIONS[activeEntity][control[0]] || 0}
                  onChange={updateAssumption}
                />
              ))}
            </div>

            <div className="assumption-drawer__actions">
              <button type="button" className="secondary-action secondary-action--light" onClick={resetActiveAssumptions}>
                Reset to benchmark
              </button>
              <button type="button" className="primary-action" onClick={() => setShowAssumptions(false)}>
                Apply assumptions
              </button>
            </div>
          </aside>
        </section>
      )}

      <footer className="footer">
        <span>Kale Logistics Solutions</span>
        <span>ACS Airport Community Systems</span>
      </footer>
    </main>
  )
}
