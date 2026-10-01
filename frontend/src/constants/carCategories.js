export const CAR_CATEGORY_OPTIONS = [
  { value: 'car', label: 'Cars' },
  { value: 'bakkie', label: 'Bakkies' },
  { value: 'motorcycle', label: 'Motorcycles' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'accessory', label: 'Accessories' }
];

export const DEFAULT_CAR_CATEGORY = 'car';

export function getCarCategoryLabel(value) {
  return (
    CAR_CATEGORY_OPTIONS.find((category) => category.value === value)?.label ||
    CAR_CATEGORY_OPTIONS[0].label
  );
}
