// Centres géographiques des arrondissements parisiens
export const ARR_CENTERS: Record<number, { lat: number; lng: number }> = {
  1:  { lat: 48.8606, lng: 2.3477 },
  2:  { lat: 48.8661, lng: 2.3477 },
  3:  { lat: 48.8630, lng: 2.3601 },
  4:  { lat: 48.8549, lng: 2.3527 },
  5:  { lat: 48.8462, lng: 2.3461 },
  6:  { lat: 48.8496, lng: 2.3341 },
  7:  { lat: 48.8566, lng: 2.3122 },
  8:  { lat: 48.8741, lng: 2.3036 },
  9:  { lat: 48.8764, lng: 2.3363 },
  10: { lat: 48.8764, lng: 2.3641 },
  11: { lat: 48.8590, lng: 2.3790 },
  12: { lat: 48.8393, lng: 2.3930 },
  13: { lat: 48.8320, lng: 2.3564 },
  14: { lat: 48.8330, lng: 2.3264 },
  15: { lat: 48.8425, lng: 2.2967 },
  16: { lat: 48.8636, lng: 2.2769 },
  17: { lat: 48.8877, lng: 2.3135 },
  18: { lat: 48.8916, lng: 2.3446 },
  19: { lat: 48.8816, lng: 2.3823 },
  20: { lat: 48.8641, lng: 2.4019 },
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Retourne les arrondissements triés du plus proche au plus loin
export function arrondissementsByDistance(lat: number, lng: number): number[] {
  return Object.entries(ARR_CENTERS)
    .map(([arr, center]) => ({
      arr: Number(arr),
      dist: haversineKm(lat, lng, center.lat, center.lng),
    }))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.arr)
}
