/**
 * Tokens compartidos light/dark.
 * Fuente de verdad: app/globals.css (:root / .dark).
 * Dark: navy + glow cian. Light: canvas slate frío, acento sky en CTAs/activo.
 */

export const UI = {
  page:
    'min-h-screen bg-background p-4 md:p-6',
  /** Lienzo de la pantalla: el cuadro más oscuro detrás de las tarjetas. */
  canvas:
    'rounded-xl bg-gradient-to-b from-slate-100 via-slate-50 to-white p-3 dark:from-surface-deep dark:via-surface-deep dark:to-surface-deep',
  stack: 'space-y-6',

  navbar:
    'rounded-xl border border-border bg-card px-5 py-3 flex items-center justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_0_25px_rgba(15,23,42,0.9)]',
  navLabel:
    'text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground',
  navTitle:
    'text-sm font-medium tracking-[0.18em] uppercase text-foreground',
  navDivider: 'h-6 w-px bg-border',

  heading: 'text-2xl font-bold text-foreground',
  subheading: 'text-sm text-muted-foreground',

  card:
    'bg-card border border-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)] dark:shadow-lg rounded-xl dark:bg-gradient-to-br dark:from-card dark:to-background',
  panel:
    'rounded-lg border border-border bg-muted/60 shadow-sm dark:shadow-none',
  note:
    'rounded-lg border border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground shadow-sm dark:shadow-none',

  input:
    'bg-card dark:bg-surface-deep border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary shadow-sm dark:shadow-none',
  select:
    'w-full h-9 rounded-md bg-card dark:bg-surface-deep border border-input text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm dark:shadow-none',
  label: 'text-xs uppercase tracking-wider text-muted-foreground',

  listItem:
    'rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 shadow-sm dark:shadow-none transition-colors',
  listItemActive:
    'rounded-lg border border-primary bg-primary/8 dark:bg-primary/10 shadow-sm dark:shadow-none transition-colors',

  tableHead:
    'bg-muted text-muted-foreground text-xs uppercase tracking-wider',
  tableRow:
    'border-t border-border hover:bg-muted/50',

  dropdown:
    'rounded-xl border border-border bg-card shadow-[0_16px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_0_25px_rgba(14,136,201,0.2)] z-50 overflow-hidden',
  dropdownBorder: 'border-border',
  iconBtn:
    'border-border bg-card dark:bg-slate-950/60 text-muted-foreground hover:text-primary hover:bg-muted shadow-sm dark:shadow-none',

  textPrimary: 'text-foreground',
  textSecondary: 'text-slate-700 dark:text-slate-300',
  textMuted: 'text-muted-foreground',
  textFaint: 'text-slate-400 dark:text-slate-500',

  /** Valores numéricos / costos en light usan tono más oscuro para contraste */
  textCost: 'text-emerald-600 dark:text-emerald-400',
  textStockOk: 'text-emerald-600 dark:text-green-400',
  textStockBad: 'text-red-600 dark:text-red-400',
  textWarn: 'text-amber-600 dark:text-amber-400',

  divide: 'divide-border',
  borderSoft: 'border-border',
  borderHairline: 'border-border/70',

  /** Pantallas densas tipo escritorio (ingreso de compras) */
  densePanel:
    'rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none',
  densePanelTitle:
    'px-3 py-1.5 border-b border-border text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
  denseLabel: 'text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap',
  denseInput:
    'h-7 px-2 text-xs rounded-md bg-card dark:bg-surface-deep border border-input text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-60 shadow-none',
  denseSelect:
    'h-7 px-1.5 text-xs rounded-md bg-card dark:bg-surface-deep border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60',
  denseMono: 'font-mono tabular-nums',
  denseTable: 'w-full text-xs border-collapse',
  denseTh:
    'sticky top-0 z-10 bg-muted text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 text-left whitespace-nowrap',
  denseTd: 'px-2 py-1 border-t border-border whitespace-nowrap',
  denseRow: 'hover:bg-muted/60 cursor-pointer',
  denseRowActive: 'bg-primary/10 text-primary',
  denseBtn:
    'h-7 px-2.5 text-xs rounded-md inline-flex items-center gap-1 border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none',
  denseBtnPrimary:
    'h-7 px-2.5 text-xs rounded-md inline-flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none',
  denseBtnDanger:
    'h-7 px-2.5 text-xs rounded-md inline-flex items-center gap-1 border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 disabled:pointer-events-none',
  /** Controles del Word aún sin definir por el cliente: visibles pero deshabilitados */
  densePending:
    'opacity-55 cursor-not-allowed select-none',
  densePendingTag:
    'inline-flex items-center rounded px-1 text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',

  avisoOk:
    'rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  avisoError:
    'rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300',
} as const;
