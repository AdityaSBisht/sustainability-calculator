// Constants from the Excel sheet
const TONNAGE_PER_AWB = 0.72
const AWBS_PER_TRUCK = 4
const HOURS_SAVED_PER_TRUCK = 4
const CO2_GRAMS_PER_GALLON = 10000
const FUEL_BURN_PER_HOUR = 0.6  // gallons/hr idling
const PAPER_COPIES_PER_SHIPMENT = 10
const PAPER_COPIES_PER_TREE = 10000

// Time savings in minutes per stakeholder — fixed from the Savings sheet
// These never change, only the wage rates change per country
const FORWARDER_MINUTES = 190   // 20+10+20+10+120+10
const FORWARDER_FLAT   = 8      // e-AWB flat cost saving (not time-based)
const HANDLER_MINUTES  = 75     // 30+25+15+5
const CARRIER_MINUTES  = 40     // 20+5+15

export function calculate(annualTonnage, countryData) {
  const {
    diesel_price_per_gallon,
    trucker_wage_per_hr,
    handler_wage_per_hr,
    carrier_wage_per_hr,
    forwarder_wage_per_hr,
  } = countryData

  // --- Base ---
  const numAWBs  = annualTonnage / TONNAGE_PER_AWB
  const numTrucks = numAWBs / AWBS_PER_TRUCK

  // --- Environmental ---
  const fuelSavedGallons = numTrucks * HOURS_SAVED_PER_TRUCK * FUEL_BURN_PER_HOUR
  const co2SavedKgs      = (fuelSavedGallons * CO2_GRAMS_PER_GALLON) / 1000
  const paperCopiesSaved = numAWBs * PAPER_COPIES_PER_SHIPMENT
  const treesSaved       = paperCopiesSaved / PAPER_COPIES_PER_TREE

  // --- Dynamic per-shipment savings based on country wages ---
  // Forwarder: time-based + flat e-AWB saving
  const forwarderSavingsPerShipment = (FORWARDER_MINUTES / 60) * forwarder_wage_per_hr + FORWARDER_FLAT
  // Handler: time-based only
  const handlerSavingsPerShipment   = (HANDLER_MINUTES / 60) * handler_wage_per_hr
  // Carrier: time-based only
  const carrierSavingsPerShipment   = (CARRIER_MINUTES / 60) * carrier_wage_per_hr

  // --- Economic ---
  const driverCostSavings  = numTrucks * HOURS_SAVED_PER_TRUCK * trucker_wage_per_hr
  const fuelCostSaved      = fuelSavedGallons * diesel_price_per_gallon
  const handlerSavings     = numAWBs * handlerSavingsPerShipment
  const forwarderSavings   = numAWBs * forwarderSavingsPerShipment
  const carrierSavings     = numAWBs * carrierSavingsPerShipment
  const totalCommunitySavings = driverCostSavings + fuelCostSaved + handlerSavings + forwarderSavings + carrierSavings

  return {
    numAWBs:  Math.round(numAWBs),
    numTrucks: Math.round(numTrucks),

    fuelSavedGallons:    Math.round(fuelSavedGallons),
    co2SavedKgs:         Math.round(co2SavedKgs),
    treesSaved:          Math.round(treesSaved),

    driverCostSavings:      Math.round(driverCostSavings),
    fuelCostSaved:          Math.round(fuelCostSaved),
    handlerSavings:         Math.round(handlerSavings),
    forwarderSavings:       Math.round(forwarderSavings),
    carrierSavings:         Math.round(carrierSavings),
    totalCommunitySavings:  Math.round(totalCommunitySavings),

    // expose per-shipment rates for transparency
    forwarderSavingsPerShipment: Math.round(forwarderSavingsPerShipment * 100) / 100,
    handlerSavingsPerShipment:   Math.round(handlerSavingsPerShipment * 100) / 100,
    carrierSavingsPerShipment:   Math.round(carrierSavingsPerShipment * 100) / 100,
  }
}