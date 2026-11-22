export const materialRegions = {
  honeycomb: { label: 'Honeycomb', color: '#202124' },
  liner: { label: 'Inner shell', color: '#B8BFC1' },
  shell: { label: 'Outer shell and clips', color: '#F3E308' },
} as const;

export function gridMaterialLabel(pattern: string) {
  if (pattern === 'parallel-louvers') return 'Louvers';
  if (pattern === 'honeycomb') return materialRegions.honeycomb.label;
  return 'Eggcrate grid';
}
