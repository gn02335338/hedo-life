// Shared by persistence, vehicle creation and rendering; keep this registry free
// of runtime dependencies so adding a private car cannot introduce an import cycle.
export const OWNED_CAR_CATALOG = Object.freeze([
  { id: 'owned-hatch', name: '都會小車', price: 250, colorId: 'mint', color: 0x78b6a0, variant: 'hatch' },
  { id: 'owned-sedan', name: '行政轎車', price: 350, colorId: 'pearl', color: 0xe8e9e3, variant: 'sedan' },
  { id: 'owned-suv', name: '遠行休旅', price: 600, colorId: 'violet', color: 0x9484be, variant: 'suv' },
].map(Object.freeze));
export const PRIVATE_GARAGE_RULES = Object.freeze({ capacity: 3, recoverPrice: 120, radius: 7, maxSpeed: 1 });
