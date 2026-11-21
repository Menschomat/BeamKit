export const materialRegions = {
  honeycomb: { label: 'Honeycomb', color: '#202124' },
  liner: { label: 'Inner shell', color: '#858791' },
  shell: { label: 'Outer shell and clips', color: '#FF634A' },
} as const;

export function gridMaterialLabel(pattern: string) {
  if (pattern === 'parallel-louvers') return 'Louvers';
  if (pattern === 'honeycomb') return materialRegions.honeycomb.label;
  return 'Eggcrate grid';
}
