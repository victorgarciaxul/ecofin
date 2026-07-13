// ECOFIN guarda los datos por mes (no por día). El DateRangePicker trabaja con
// fechas reales (día concreto), así que aquí lo traducimos a "qué meses toca"
// dentro del año que se esté analizando.

// Año predominante del rango (el que más meses aporta; empate → año de "to")
export function dominantYear(from, to) {
  if (!from || !to) return new Date().getFullYear()
  const yFrom = from.getFullYear()
  const yTo   = to.getFullYear()
  if (yFrom === yTo) return yFrom
  // Cuenta meses que caen en cada año dentro del rango
  const counts = {}
  let d = new Date(yFrom, from.getMonth(), 1)
  const end = new Date(yTo, to.getMonth(), 1)
  while (d <= end) {
    counts[d.getFullYear()] = (counts[d.getFullYear()] || 0) + 1
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  const years = Object.keys(counts).map(Number)
  const max = Math.max(...years.map(y => counts[y]))
  const tied = years.filter(y => counts[y] === max)
  return tied.includes(yTo) ? yTo : Math.max(...tied)
}

// Meses (1-12) que el rango cubre dentro de un año concreto — recortados a ese año.
// Si el rango no toca ese año, devuelve el año completo (1-12) para no dejar la vista vacía.
export function monthsInYear(from, to, year) {
  if (!from || !to) return { desde: 1, hasta: 12 }
  const yFrom = from.getFullYear(), yTo = to.getFullYear()
  if (year < yFrom || year > yTo) return { desde: 1, hasta: 12 }
  const desde = year === yFrom ? from.getMonth() + 1 : 1
  const hasta = year === yTo   ? to.getMonth() + 1   : 12
  return { desde, hasta }
}
