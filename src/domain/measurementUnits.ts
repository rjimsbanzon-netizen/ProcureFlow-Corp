/** Unified units for requisitions and all procurement views.
 * Persist the short `value` code on requisitions, stock needs, POs and deliveries.
 * The `label` and groups are presentation metadata only; no changes to stored legacy codes.
 * Quantity remains integer in the current approval, delivery and inventory workflows.
 */
export const UNIT_GROUPS = [
  { label: 'Count & quantity', units: [
    { value: 'units', label: 'Units' },
    { value: 'pcs', label: 'Pieces (pcs)' },
    { value: 'sets', label: 'Sets' },
    { value: 'pairs', label: 'Pairs' },
    { value: 'dozen', label: 'Dozen (doz)' },
    { value: 'lots', label: 'Lots' },
  ] },
  { label: 'Packaging & supplies', units: [
    { value: 'packs', label: 'Packs' },
    { value: 'boxes', label: 'Boxes' },
    { value: 'cartons', label: 'Cartons' },
    { value: 'cases', label: 'Cases' },
    { value: 'bundles', label: 'Bundles' },
    { value: 'reams', label: 'Reams' },
    { value: 'rolls', label: 'Rolls' },
    { value: 'sheets', label: 'Sheets' },
    { value: 'bags', label: 'Bags' },
    { value: 'sacks', label: 'Sacks' },
    { value: 'bottles', label: 'Bottles' },
    { value: 'cans', label: 'Cans' },
    { value: 'jars', label: 'Jars' },
    { value: 'tubes', label: 'Tubes' },
    { value: 'vials', label: 'Vials' },
    { value: 'trays', label: 'Trays' },
    { value: 'pallets', label: 'Pallets' },
  ] },
  { label: 'Weight / mass', units: [
    { value: 'mg', label: 'Milligrams (mg)' },
    { value: 'g', label: 'Grams (g)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 't', label: 'Metric tons (t)' },
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'lb', label: 'Pounds (lb)' },
  ] },
  { label: 'Length', units: [
    { value: 'mm', label: 'Millimeters (mm)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'm', label: 'Meters (m)' },
    { value: 'km', label: 'Kilometers (km)' },
    { value: 'in', label: 'Inches (in)' },
    { value: 'ft', label: 'Feet (ft)' },
    { value: 'yd', label: 'Yards (yd)' },
  ] },
  { label: 'Area', units: [
    { value: 'sqcm', label: 'Square centimeters (cm²)' },
    { value: 'sqm', label: 'Square meters (m²)' },
    { value: 'sqft', label: 'Square feet (ft²)' },
    { value: 'ha', label: 'Hectares (ha)' },
  ] },
  { label: 'Volume / capacity', units: [
    { value: 'ml', label: 'Milliliters (mL)' },
    { value: 'l', label: 'Liters (L)' },
    { value: 'gal', label: 'Gallons (gal)' },
    { value: 'cc', label: 'Cubic centimeters (cm³)' },
    { value: 'cbm', label: 'Cubic meters (m³)' },
  ] },
  { label: 'Time & services', units: [
    { value: 'hr', label: 'Hours (hr)' },
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' },
    { value: 'services', label: 'Services' },
    { value: 'licenses', label: 'Licenses' },
    { value: 'subscriptions', label: 'Subscriptions' },
  ] },
] as const;

export type QuantityUnit = (typeof UNIT_GROUPS)[number]['units'][number]['value'];
export type MeasurementUnitOption = { readonly value: QuantityUnit; readonly label: string };
export type MeasurementUnitGroup = { readonly label: string; readonly units: readonly MeasurementUnitOption[] };

/** Search both unit names/codes and their category (e.g. 'weight' finds kg and g). */
export function searchMeasurementUnitGroups(query: string): readonly MeasurementUnitGroup[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return UNIT_GROUPS;
  const matches = (text: string) => {
    const source = text.toLocaleLowerCase();
    // Match a word prefix, not an arbitrary substring (e.g. searching "time"
    // should not return "centimeters"). Also allow multi-word phrase prefixes.
    return source.startsWith(term) || source.split(/[^a-z0-9]+/).some(word => word.startsWith(term));
  };
  return UNIT_GROUPS.map(group => ({
    label: group.label,
    units: group.units.filter(unit =>
      matches(group.label) || matches(unit.label) || matches(unit.value)
    ),
  })).filter(group => group.units.length > 0);
}

const UNIT_OPTIONS: readonly { value: QuantityUnit; label: string }[] = UNIT_GROUPS.flatMap(group =>
  group.units.map(unit => ({ value: unit.value, label: unit.label }))
);
export const QUANTITY_UNITS: readonly QuantityUnit[] = UNIT_OPTIONS.map(unit => unit.value);
export const isQuantityUnit = (value: unknown): value is QuantityUnit =>
  typeof value === 'string' && QUANTITY_UNITS.some(unit => unit === value);
/** A safe default for an omitted or invalid unit, preserving the original common code. */
export const unitLabel = (value: unknown): QuantityUnit => isQuantityUnit(value) ? value : 'units';
export const unitName = (value: unknown): string => {
  const match = UNIT_OPTIONS.find(unit => unit.value === value);
  return match?.label ?? String(value || 'units');
};
/** For legacy server-rendered forms using HTML string templates (this catalog is static). */
export const measurementUnitOptionsHtml = (query = ''): string => searchMeasurementUnitGroups(query).map(group =>
  `<optgroup label="${group.label}">${group.units.map(unit =>
    `<option value="${unit.value}">${unit.label}</option>`).join('')}</optgroup>`
).join('');

/** Display-only symbols for the stored 53-unit catalog. Do not use them in payloads. */
const DISPLAY_SYMBOLS: Readonly<Record<string, string>> = {
  sqcm: 'cm²', sqm: 'm²', sqft: 'ft²', cc: 'cm³', cbm: 'm³', ml: 'mL', l: 'L',
};
export function displayUnit(unit: unknown): string {
  const value = unitLabel(unit);
  return DISPLAY_SYMBOLS[value] || value;
}
/** Format a quantity and the selected unit together, including legacy records. */
export function formatQuantity(quantity: number | string | null | undefined, unit: unknown): string {
  const numberValue = Number(quantity);
  const shown = quantity === null || quantity === undefined || quantity === '' ? '—' :
    Number.isFinite(numberValue) ? numberValue.toLocaleString('en-PH', { maximumFractionDigits: 3 }) : '—';
  return `${shown} ${displayUnit(unit)}`;
}
export function formatQuantityRatio(received: number | string, ordered: number | string, unit: unknown): string {
  const format = (quantity: number | string) => {
    const value = Number(quantity);
    return Number.isFinite(value) ? value.toLocaleString('en-PH', { maximumFractionDigits: 3 }) : '—';
  };
  return `${format(received)} / ${format(ordered)} ${displayUnit(unit)}`;
}
