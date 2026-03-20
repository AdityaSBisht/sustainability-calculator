'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [countries, setCountries] = useState([])

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase.from('country_data').select('*')
      if (error) console.error(error)
      else setCountries(data)
    }
    fetchData()
  }, [])

  return (
    <div>
      {countries.map(c => (
        <p key={c.id}>{c.country} — ${c.diesel_price_per_gallon}/gal</p>
      ))}
    </div>
  )
}