'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { calculate } from '../utils/calculator'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend
} from 'recharts'

// --- Unit helpers ---
const GALLON_TO_LITRE = 3.785
const METRIC_COUNTRIES = [
  'India', 'United Kingdom', 'Germany', 'Singapore', 'Australia',
  'Canada', 'China', 'Brazil', 'UAE'
]
function useMetric(country) { return METRIC_COUNTRIES.includes(country) }
function fuelValue(gallons, metric) { return metric ? Math.round(gallons * GALLON_TO_LITRE) : gallons }
function fuelUnit(metric) { return metric ? 'litres' : 'gal' }
function co2Value(kgs, metric) { return metric ? kgs : Math.round(kgs * 2.205) }
function co2Unit(metric) { return metric ? 'kgs' : 'lbs' }

// --- Compound growth multiplier ---
function compoundMultiplier(years, growthPct) {
  if (years === 1) return 1
  const r = growthPct / 100
  let total = 0
  for (let y = 0; y < years; y++) {
    total += Math.pow(1 + r, y)
  }
  return total
}

function growthLabel(rate) {
  if (rate === 0) return 'Flat — no growth applied'
  if (rate <= 5) return 'Mature market — conservative'
  if (rate <= 15) return 'Steady — typical developing markets'
  if (rate <= 30) return 'High growth — SE Asia & Middle East'
  if (rate <= 60) return 'Aggressive — emerging hub airports'
  return 'Hyper growth — rapidly expanding'
}

// --- Animated number hook ---
function useCountUp(target, duration = 1500) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    setValue(0)
    let start = 0
    const steps = 60
    const increment = target / steps
    const interval = duration / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, interval)
    return () => clearInterval(timer)
  }, [target])
  return value
}

function StatCard({ label, value, unit, icon, isCurrency = false, delay = 0 }) {
  const animated = useCountUp(value)
  return (
    <div style={{
      background: '#111111', border: '1px solid #222', borderRadius: 16,
      padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 12,
      animation: `fadeIn 0.5s ease ${delay}ms forwards`, opacity: 0,
      position: 'relative', overflow: 'hidden', minWidth: 0
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #00e87a, transparent)' }} />
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: 'clamp(16px, 2.5vw, 28px)',
        fontWeight: 700, color: '#00e87a', letterSpacing: '-0.5px',
        wordBreak: 'break-all', display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap'
      }}>
        {isCurrency && <span style={{ fontSize: 'clamp(14px, 2vw, 22px)', color: '#00e87a', opacity: 0.8 }}>{unit}</span>}
        {animated.toLocaleString()}
        {!isCurrency && <span style={{ fontSize: 12, color: '#00e87a', opacity: 0.6, marginLeft: 2 }}>{unit}</span>}
      </span>
      <span style={{ fontSize: 11, color: '#00e87a', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  )
}

const BarTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>
        <p style={{ color: '#aaa', marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#00e87a' }}>{currency}{payload[0].value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

const BarLabel = ({ x, y, width, value, currency }) => {
  if (!value) return null
  const display = value >= 1000000
    ? `${currency}${(value / 1000000).toFixed(1)}M`
    : value >= 1000
    ? `${currency}${(value / 1000).toFixed(0)}K`
    : `${currency}${value}`
  return <text x={x + width / 2} y={y - 6} fill='#aaaaaa' textAnchor='middle' fontSize={10} fontFamily='Space Mono, monospace'>{display}</text>
}

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill='#000' textAnchor='middle' dominantBaseline='central' fontSize={11} fontWeight={700} fontFamily='Space Mono, monospace'>{`${(percent * 100).toFixed(0)}%`}</text>
}

const CHART_COLORS = ['#00e87a', '#4d9fff', '#f5a623', '#c084fc', '#f87171']

export default function Home() {
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [countryData, setCountryData] = useState(null)
  const [tonnage, setTonnage] = useState(1250000)
  const [tonnageDisplay, setTonnageDisplay] = useState('1,250,000')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [years, setYears] = useState(1)
  const [growthRate, setGrowthRate] = useState(5)
  const resultsRef = useRef(null)
  const metric = useMetric(selectedCountry)
  const multiplier = compoundMultiplier(years, growthRate)

  useEffect(() => {
    async function fetchCountries() {
      const { data } = await supabase.from('country_data').select('country').order('country')
      setCountries(data || [])
    }
    fetchCountries()
  }, [])

  useEffect(() => {
    if (!selectedCountry) return
    async function fetchCountryData() {
      const { data } = await supabase.from('country_data').select('*').eq('country', selectedCountry).single()
      setCountryData(data)
    }
    fetchCountryData()
  }, [selectedCountry])

  function handleTonnageInput(e) {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || isNaN(raw)) return
    const num = Number(raw)
    setTonnage(num)
    setTonnageDisplay(num.toLocaleString())
  }

  function handleSlider(e) {
    const num = Number(e.target.value)
    setTonnage(num)
    setTonnageDisplay(num.toLocaleString())
  }

  function handleCalculate() {
    if (!countryData || !tonnage) return
    setLoading(true)
    setResults(null)
    setYears(1)
    setGrowthRate(5)
    setTimeout(() => {
      const output = calculate(Number(tonnage), countryData)
      setResults(output)
      setLoading(false)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }, 400)
  }

  const chartData = results ? [
    { name: 'Driver',    value: Math.round(results.driverCostSavings * multiplier) },
    { name: 'Forwarder', value: Math.round(results.forwarderSavings * multiplier) },
    { name: 'Handler',   value: Math.round(results.handlerSavings * multiplier) },
    { name: 'Carrier',   value: Math.round(results.carrierSavings * multiplier) },
    { name: 'Fuel',      value: Math.round(results.fuelCostSaved * multiplier) },
  ] : []

  const currency = countryData?.currency_symbol || '$'

  return (
    <main style={{ minHeight: '100vh', background: '#080808' }}>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.25)', borderRadius: 999, padding: '6px 16px', fontSize: 12, color: '#00e87a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
          Sustainability Impact Calculator
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: 20, color: '#ffffff' }}>
          Measure Your<br /><span style={{ color: '#00e87a' }}>Environmental Impact</span>
        </h1>
        <p style={{ fontSize: 17, color: '#666', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
          Enter your airport's annual cargo tonnage and see the real-world sustainability savings your logistics operations generate.
        </p>
      </section>

      {/* Input Card */}
      <section style={{ maxWidth: 700, margin: '0 auto 60px', padding: '0 24px' }}>
        <div style={{ background: '#111111', border: '1px solid #222', borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Country */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00e87a', opacity: 0.7 }}>Country</label>
            <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, color: selectedCountry ? '#ffffff' : '#666', fontFamily: 'Syne, sans-serif', fontSize: 15, padding: '14px 16px', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300e87a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '12px' }}>
              <option value='' style={{ background: '#1a1a1a', color: '#666' }}>Select a country...</option>
              {countries.map(c => <option key={c.country} value={c.country} style={{ background: '#1a1a1a', color: '#fff' }}>{c.country}</option>)}
            </select>
          </div>

          {/* Tonnage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00e87a', opacity: 0.7 }}>Annual Tonnage</label>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#f5a623', fontWeight: 700 }}>{Number(tonnage).toLocaleString()} tons</span>
            </div>
            <input type='range' min={100000} max={5000000} step={50000} value={tonnage} onChange={handleSlider} style={{ accentColor: '#f5a623', cursor: 'pointer', width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#555' }}>100K</span>
              <span style={{ fontSize: 11, color: '#555' }}>5M</span>
            </div>
            <input type='text' value={tonnageDisplay} onChange={handleTonnageInput} style={{ background: '#1a1a1a', border: '1px solid #f5a623', borderRadius: 10, color: '#ffffff', fontFamily: 'Space Mono, monospace', fontSize: 15, padding: '12px 16px', outline: 'none', marginTop: 4 }} />
          </div>

          {/* Calculate Button */}
          <button onClick={handleCalculate} disabled={!selectedCountry || !tonnage || loading} style={{ background: selectedCountry && tonnage ? '#00e87a' : '#1a1a1a', color: selectedCountry && tonnage ? '#000000' : '#555', border: 'none', borderRadius: 10, padding: '16px', fontSize: 15, fontWeight: 700, fontFamily: 'Syne, sans-serif', cursor: selectedCountry && tonnage ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease', letterSpacing: '0.02em' }}>
            {loading ? 'Calculating...' : 'Calculate Impact →'}
          </button>

          {/* Growth Rate — only shows after first calculation */}
          {results && (
            <div style={{
              borderTop: '1px solid #1e1e1e',
              paddingTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'fadeIn 0.5s ease forwards'
            }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>📈</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Syne, sans-serif', margin: 0 }}>
                    Model growth scenarios
                  </p>
                  <p style={{ fontSize: 11, color: '#555', fontFamily: 'Space Mono, monospace', margin: '3px 0 0' }}>
                    Adjust to see how tonnage growth compounds over 5 or 10 years
                  </p>
                </div>
              </div>

              {/* Slider row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4d9fff', opacity: 0.8 }}>
                  Annual Tonnage Growth
                </label>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 16, color: '#4d9fff', fontWeight: 700 }}>
                  {growthRate}%
                </span>
              </div>
              <input
                type='range' min={0} max={100} step={1}
                value={growthRate}
                onChange={e => setGrowthRate(Number(e.target.value))}
                style={{ accentColor: '#4d9fff', cursor: 'pointer', width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#333' }}>0% flat</span>
                <span style={{ fontSize: 11, color: '#333' }}>100%</span>
              </div>

              {/* Context hint */}
              <div style={{ background: 'rgba(77,159,255,0.06)', border: '1px solid rgba(77,159,255,0.12)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 11, color: '#4d9fff', fontFamily: 'Space Mono, monospace', margin: 0, opacity: 0.85 }}>
                  {growthLabel(growthRate)}
                </p>
                {years > 1 && (
                  <p style={{ fontSize: 11, color: '#444', fontFamily: 'Space Mono, monospace', margin: 0 }}>
                    Year 1: {Number(tonnage).toLocaleString()} → Year {years}: {Math.round(tonnage * Math.pow(1 + growthRate / 100, years - 1)).toLocaleString()} tons
                    {growthRate > 0 && ` · ×${compoundMultiplier(years, growthRate).toFixed(2)} vs ×${years} flat`}
                  </p>
                )}
                {years === 1 && (
                  <p style={{ fontSize: 11, color: '#444', fontFamily: 'Space Mono, monospace', margin: 0 }}>
                    Switch to 5Y or 10Y in the results to see compound impact
                  </p>
                )}
              </div>

              {/* Year Toggle — lives here too for convenience */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[1, 5, 10].map(y => (
                  <button key={y} onClick={() => setYears(y)} style={{ flex: 1, background: years === y ? '#4d9fff' : '#1a1a1a', color: years === y ? '#000000' : '#666', border: years === y ? 'none' : '1px solid #2a2a2a', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, fontFamily: 'Syne, sans-serif', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    {y === 1 ? '1 Year' : `${y} Years`}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Results */}
      {results && (
        <section ref={resultsRef} style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 80px' }}>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ height: 1, flex: 1, background: '#222' }} />
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00e87a', opacity: 0.6 }}>
              {years === 1 ? 'Annual Impact' : `${years}-Year Cumulative Impact${growthRate > 0 ? ` @ ${growthRate}% growth` : ' (flat)'}`} — {selectedCountry}
            </span>
            <div style={{ height: 1, flex: 1, background: '#222' }} />
          </div>

          {/* Environmental Cards */}
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00e87a', opacity: 0.6, marginBottom: 16 }}>Environmental</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard icon='🌿' label='CO₂ Saved' value={co2Value(Math.round(results.co2SavedKgs * multiplier), metric)} unit={co2Unit(metric)} delay={0} />
            <StatCard icon='🌳' label='Trees Saved' value={Math.round(results.treesSaved * multiplier)} unit='trees' delay={100} />
            <StatCard icon='⛽' label='Fuel Saved' value={fuelValue(Math.round(results.fuelSavedGallons * multiplier), metric)} unit={fuelUnit(metric)} delay={200} />
          </div>

          {/* Economic Cards */}
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00e87a', opacity: 0.6, marginBottom: 16 }}>Economic</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard icon='💰' label='Total Community Savings' value={Math.round(results.totalCommunitySavings * multiplier)} unit={currency} isCurrency delay={0} />
            <StatCard icon='🚚' label='Driver Cost Savings' value={Math.round(results.driverCostSavings * multiplier)} unit={currency} isCurrency delay={100} />
            <StatCard icon='📦' label='Handler Savings' value={Math.round(results.handlerSavings * multiplier)} unit={currency} isCurrency delay={200} />
          </div>

          {/* Bar Chart */}
          <div style={{ background: '#111111', border: '1px solid #222', borderRadius: 16, padding: '28px 24px', animation: 'fadeIn 0.5s ease 300ms forwards', opacity: 0 }}>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 24 }}>Savings Breakdown by Stakeholder</p>
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={chartData} barSize={36} margin={{ top: 24, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey='name' tick={{ fill: '#aaaaaa', fontSize: 12, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<BarTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  <LabelList content={<BarLabel currency={currency} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Donut Chart */}
          <div style={{ background: '#111111', border: '1px solid #222', borderRadius: 16, padding: '28px 24px', marginTop: 20, animation: 'fadeIn 0.5s ease 350ms forwards', opacity: 0 }}>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 6 }}>Savings Distribution by Stakeholder</p>
            <p style={{ fontSize: 12, color: '#555', fontFamily: 'Space Mono, monospace', marginBottom: 24 }}>Who benefits most from ACS adoption</p>
            <ResponsiveContainer width='100%' height={320}>
              <PieChart>
                <Pie data={chartData} cx='50%' cy='50%' innerRadius={70} outerRadius={120} paddingAngle={3} dataKey='value' labelLine={false} label={PieLabel}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const total = chartData.reduce((a, b) => a + b.value, 0)
                    const pct = ((payload[0].value / total) * 100).toFixed(1)
                    return (
                      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>
                        <p style={{ color: '#aaa', marginBottom: 4 }}>{payload[0].name}</p>
                        <p style={{ color: '#00e87a' }}>{currency}{payload[0].value.toLocaleString()}</p>
                        <p style={{ color: '#00e87a', marginTop: 2, fontWeight: 700 }}>{pct}% of total</p>
                      </div>
                    )
                  }
                  return null
                }} />
                <Legend formatter={(value) => <span style={{ color: '#cccccc', fontSize: 12, fontFamily: 'Space Mono, monospace' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* AWB Summary */}
          <div style={{ marginTop: 20, background: 'rgba(0,232,122,0.06)', border: '1px solid rgba(0,232,122,0.2)', borderRadius: 16, padding: '32px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, animation: 'fadeIn 0.5s ease 400ms forwards', opacity: 0 }}>
            {[
              { label: 'Est. AWBs',        value: results.numAWBs.toLocaleString(),                                   prefix: '' },
              { label: 'Est. Trucks',       value: results.numTrucks.toLocaleString(),                                 prefix: '' },
              { label: 'Forwarder Savings', value: Math.round(results.forwarderSavings * multiplier).toLocaleString(), prefix: currency },
              { label: 'Carrier Savings',   value: Math.round(results.carrierSavings * multiplier).toLocaleString(),   prefix: currency },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, color: '#00e87a', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{item.label}</span>
                <p style={{ fontFamily: 'Space Mono', fontSize: 20, color: '#00e87a', fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>{item.prefix}{item.value}</p>
              </div>
            ))}
          </div>

        </section>
      )}

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #161616' }}>
        <p style={{ fontSize: 12, color: '#333', fontFamily: 'Space Mono, monospace', letterSpacing: '0.05em' }}>
          Developed by Aditya and Atharva
        </p>
      </footer>

    </main>
  )
}