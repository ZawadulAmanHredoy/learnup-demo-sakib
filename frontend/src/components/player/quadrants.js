/**
 * Universal 4-color answer quadrant (Design.md §1.1) — identical on stage and mobile.
 */
export const QUADRANTS = [
  { letter: 'A', symbol: '▲', name: 'Crimson', hex: '#EF4444', bg: 'bg-quadrant-red', ring: 'ring-red-300', shadow: 'shadow-red-900/50' },
  { letter: 'B', symbol: '◆', name: 'Cobalt', hex: '#3B82F6', bg: 'bg-quadrant-blue', ring: 'ring-blue-300', shadow: 'shadow-blue-900/50' },
  { letter: 'C', symbol: '●', name: 'Amber', hex: '#F59E0B', bg: 'bg-quadrant-amber', ring: 'ring-amber-200', shadow: 'shadow-amber-900/50' },
  { letter: 'D', symbol: '■', name: 'Emerald', hex: '#10B981', bg: 'bg-quadrant-green', ring: 'ring-emerald-200', shadow: 'shadow-emerald-900/50' },
];

export function quadrantFor(index) {
  return QUADRANTS[index % QUADRANTS.length];
}

/** Find the quadrant + option for an option id within a question packet. */
export function optionMeta(question, optionId) {
  const idx = question?.options?.findIndex(o => o.id === optionId) ?? -1;
  if (idx < 0) return null;
  return { ...quadrantFor(idx), option: question.options[idx] };
}
