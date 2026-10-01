export const DEFAULT_ACCESSORY_AVAILABILITY = 'readily_available';

export const ACCESSORY_AVAILABILITY_OPTIONS = [
  { value: DEFAULT_ACCESSORY_AVAILABILITY, label: 'Readily available' },
  { value: 'on_order', label: 'On order' }
];

export function getAccessoryAvailabilityLabel(value) {
  return (
    ACCESSORY_AVAILABILITY_OPTIONS.find((item) => item.value === value)?.label ||
    ACCESSORY_AVAILABILITY_OPTIONS[0].label
  );
}
