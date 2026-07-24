// ── Trucking Savings Calculator ──
// Based on Kale Airport Trucking Savings Calculator
// Two modes: Simple (7 inputs) and Detailed (4 sections)

const MONTHS_PER_YEAR = 12
// const DAYS_PER_YEAR   = 365

// ── SIMPLE MODE ──
// Sheet: Trucking Savings - S
export function calculateSimple({
  trucks,
  tripsPerMonth,
  roundTripDistanceMiles,
  hourlyWage,
  dieselPrice,
  mpg,
  idleMinutesPerTrip,
}, assumptions = {}) {
  const {
    fuelReduction = 18,
    timeReduction = 65,
    complianceReduction = 75,
    maintenanceReduction = 18,
  } = assumptions
  const fuelRate = fuelReduction / 100
  const timeRate = timeReduction / 100
  const complianceRate = complianceReduction / 100
  const maintenanceRate = maintenanceReduction / 100

  // Baseline
  const totalMonthlyTrips   = trucks * tripsPerMonth
  const totalMonthlyMiles   = totalMonthlyTrips * roundTripDistanceMiles
  const monthlyFuelCost     = (totalMonthlyMiles / mpg) * dieselPrice
  const driverLabourTrips   = totalMonthlyTrips * 1.5 * hourlyWage
  const idleGateCost        = totalMonthlyTrips * (idleMinutesPerTrip / 60) * hourlyWage
  const paperworkLabour     = totalMonthlyTrips * 1.2 * hourlyWage
  const regulatoryPenalty   = trucks * 320   // US industry avg $320/truck/month

  // Savings (from Excel verified formulas)
  const fuelSavings         = monthlyFuelCost * fuelRate
  const driverTimeSavings   = (idleGateCost + paperworkLabour) * timeRate
  const complianceSavings   = regulatoryPenalty * complianceRate
  const maintenanceSavings  = totalMonthlyMiles * maintenanceRate * 0.15

  const totalMonthlySavings = fuelSavings + driverTimeSavings + complianceSavings + maintenanceSavings
  const totalAnnualSavings  = totalMonthlySavings * MONTHS_PER_YEAR

  const fuelSavingsGals = (totalMonthlyMiles / mpg) * fuelRate
  const co2TonsMonth = (fuelSavingsGals * 22.4) / 2204.62
  const co2TonsYear = co2TonsMonth * 12
  const baselineTotalCost = monthlyFuelCost + driverLabourTrips + idleGateCost + paperworkLabour + regulatoryPenalty
  const projectedAcsCost = Math.max(0, baselineTotalCost - totalMonthlySavings)

  return {
    // Baseline
    totalMonthlyTrips:   Math.round(totalMonthlyTrips),
    totalMonthlyMiles:   Math.round(totalMonthlyMiles),
    monthlyFuelCost:     Math.round(monthlyFuelCost),
    driverLabourTrips:   Math.round(driverLabourTrips),
    idleGateCost:        Math.round(idleGateCost),
    paperworkLabour:     Math.round(paperworkLabour),
    regulatoryPenalty:   Math.round(regulatoryPenalty),
    baselineTotalCost,
    projectedAcsCost,
    co2TonsMonth: Number(co2TonsMonth.toFixed(1)),
    co2TonsYear: Number(co2TonsYear.toFixed(1)),
    // Savings
    fuelSavings:         Math.round(fuelSavings),
    driverTimeSavings:   Math.round(driverTimeSavings),
    complianceSavings:   Math.round(complianceSavings),
    maintenanceSavings:  Math.round(maintenanceSavings),
    totalMonthlySavings: Math.round(totalMonthlySavings),
    totalAnnualSavings:  Math.round(totalAnnualSavings),
  }
}

// ── FREIGHT FORWARDER MODE (PLACEHOLDER) ──
export function calculateForwarder({
  shipmentsPerMonth,
  paperworkTimeMins,
  hourlyWage,
  slaPenaltyMonthly,
}, assumptions = {}) {
  const {
    timeReduction = 65,
    complianceReduction = 80,
  } = assumptions
  const timeRate = timeReduction / 100
  const complianceRate = complianceReduction / 100
  const currentPaperworkLabour = shipmentsPerMonth * (paperworkTimeMins / 60) * hourlyWage

  // Savings assumptions
  const paperworkSavings = currentPaperworkLabour * timeRate
  const penaltySavings = slaPenaltyMonthly * complianceRate

  const totalMonthlySavings = paperworkSavings + penaltySavings
  const totalAnnualSavings = totalMonthlySavings * MONTHS_PER_YEAR

  const baselineTotalCost = currentPaperworkLabour + slaPenaltyMonthly
  const projectedAcsCost = baselineTotalCost - totalMonthlySavings

  return {
    // Breakdown
    fuelSavings: 0,
    driverTimeSavings: paperworkSavings,
    complianceSavings: penaltySavings,
    maintenanceSavings: 0,
    // Baseline
    totalMonthlyTrips: shipmentsPerMonth,
    totalMonthlyMiles: 0,
    monthlyFuelCost: 0,
    driverLabourTrips: 0,
    idleGateCost: 0,
    paperworkLabour: currentPaperworkLabour,
    regulatoryPenalty: slaPenaltyMonthly,
    baselineTotalCost,
    projectedAcsCost,
    co2TonsMonth: 0,
    co2TonsYear: 0,
    // Totals
    totalMonthlySavings,
    totalAnnualSavings,
  }
}

// ── AIRPORT MODE (PLACEHOLDER) ──
export function calculateAirport({
  dailyTrucks,
  turnaroundTimeMins,
  congestionCostMonthly,
}, assumptions = {}) {
  const {
    timeReduction = 40,
    complianceReduction = 70,
  } = assumptions
  const timeRate = timeReduction / 100
  const complianceRate = complianceReduction / 100
  const totalMonthlyTrucks = dailyTrucks * 30

  // Savings assumptions
  const timeSavingsHrs = totalMonthlyTrucks * (turnaroundTimeMins * timeRate) / 60
  const congestionSavings = congestionCostMonthly * complianceRate

  const totalMonthlySavings = congestionSavings + (timeSavingsHrs * 20) // assumed $20/hr value locally
  const totalAnnualSavings = totalMonthlySavings * MONTHS_PER_YEAR

  const fuelSavingsGals = timeSavingsHrs * 0.8 // 0.8 gallons idled per hour
  const co2TonsMonth = (fuelSavingsGals * 22.4) / 2204.62
  const co2TonsYear = co2TonsMonth * 12

  const baselineTotalCost = congestionCostMonthly // proxy
  const projectedAcsCost = Math.max(0, baselineTotalCost - totalMonthlySavings)

  return {
    fuelSavings: 0,
    driverTimeSavings: timeSavingsHrs * 20,
    complianceSavings: congestionSavings,
    maintenanceSavings: 0,
    // Baseline
    totalMonthlyTrips: totalMonthlyTrucks,
    totalMonthlyMiles: 0,
    monthlyFuelCost: congestionCostMonthly,
    driverLabourTrips: 0,
    idleGateCost: 0,
    paperworkLabour: 0,
    regulatoryPenalty: 0,
    baselineTotalCost,
    projectedAcsCost,
    co2TonsMonth: Number(co2TonsMonth.toFixed(1)),
    co2TonsYear: Number(co2TonsYear.toFixed(1)),
    totalMonthlySavings,
    totalAnnualSavings,
  }
}

// ── GHA MODE (PLACEHOLDER) ──
export function calculateGHA({
  monthlyAWBs,
  gateStaff,
  hourlyWage,
  waitMinsPerTruck,
}, assumptions = {}) {
  const {
    fuelReduction = 50,
    timeReduction = 30,
  } = assumptions
  const waitRate = fuelReduction / 100
  const labourRate = timeReduction / 100
  const currentLabourCost = gateStaff * 160 * hourlyWage // assuming 160 hours/month/staff
  const waitCost = monthlyAWBs * (waitMinsPerTruck / 60) * hourlyWage

  // Savings assumptions
  const labourSavings = currentLabourCost * labourRate
  const waitSavings = waitCost * waitRate

  const totalMonthlySavings = labourSavings + waitSavings
  const totalAnnualSavings = totalMonthlySavings * MONTHS_PER_YEAR

  const waitHrsTotal = monthlyAWBs * (waitMinsPerTruck / 60)
  const waitSavingsHrs = waitHrsTotal * waitRate
  const fuelSavingsGals = waitSavingsHrs * 0.8
  const co2TonsMonth = (fuelSavingsGals * 22.4) / 2204.62
  const co2TonsYear = co2TonsMonth * 12

  const baselineTotalCost = currentLabourCost + waitCost
  const projectedAcsCost = baselineTotalCost - totalMonthlySavings

  return {
    fuelSavings: waitSavings, // mapping wait time to generic "fuel/efficiency" stat card
    driverTimeSavings: labourSavings,
    complianceSavings: 0,
    maintenanceSavings: 0,
    // Baseline
    totalMonthlyTrips: monthlyAWBs,
    totalMonthlyMiles: 0,
    monthlyFuelCost: 0,
    driverLabourTrips: waitCost,
    idleGateCost: currentLabourCost,
    paperworkLabour: 0,
    regulatoryPenalty: 0,
    baselineTotalCost,
    projectedAcsCost,
    co2TonsMonth: Number(co2TonsMonth.toFixed(1)),
    co2TonsYear: Number(co2TonsYear.toFixed(1)),
    totalMonthlySavings,
    totalAnnualSavings,
  }
}
