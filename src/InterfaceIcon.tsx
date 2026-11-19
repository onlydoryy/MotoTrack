const glyphs = {
  garage: "M3 20V9l9-6 9 6v11 M7 20v-8h10v8 M8 15h8 M8 18h8",
  documents: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6",
  tools: "m4 20 9-9 M14 4a5 5 0 0 0 6 6l-3 3-4-1-7 8a2 2 0 0 1-3-3l8-7-1-4z",
  arrow: "M4 12h15 M13 6l6 6-6 6", star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3L7.5 14 3 9.6l6.2-.9z",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0 M12 7v5l3 2",
  calendar: "M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18",
  settings: "M3 7h6m6 0h6M3 17h11m5 0h2 M9 4v6h6V4z M14 14v6h5v-6z",
  plus: "M12 5v14 M5 12h14", search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2",
} as const;

export default function InterfaceIcon({ name }: { name: keyof typeof glyphs }) {
  return <svg className="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[name]} /></svg>;
}
