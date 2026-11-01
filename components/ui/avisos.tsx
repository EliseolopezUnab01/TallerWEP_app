'use client';

import { useEffect, useState } from 'react';

type Tipo = 'ok' | 'error';
type Aviso = { id: number; tipo: Tipo; texto: string };
type Pregunta = { texto: string; resolver: (v: boolean) => void };

let publicar: ((a: Aviso) => void) | null = null;
let preguntar: ((texto: string) => Promise<boolean>) | null = null;
let consecutivo = 0;

function tipoDe(texto: string): Tipo {
  return /error|no se puede|no se pudo|debe |no hay|⚠️|fall|agotad/i.test(texto) ? 'error' : 'ok';
}

/** Aviso breve en pantalla. Sustituye a alert. */
export function avisar(texto: string, tipo?: Tipo) {
  const aviso = { id: ++consecutivo, tipo: tipo ?? tipoDe(texto), texto };
  if (publicar) publicar(aviso);
}

/** Pregunta sí o no. Sustituye a confirm y hay que esperarla. */
export function confirmar(texto: string) {
  if (preguntar) return preguntar(texto);
  return Promise.resolve(false);
}

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);

  useEffect(() => {
    publicar = (a) => {
      setLista((prev) => [...prev.slice(-4), a]);
      window.setTimeout(() => setLista((prev) => prev.filter((x) => x.id !== a.id)), 4500);
    };
    preguntar = (texto) =>
      new Promise((resolver) => {
        setPregunta({ texto, resolver });
      });
    return () => {
      publicar = null;
      preguntar = null;
    };
  }, []);

  const cerrar = (valor: boolean) => {
    pregunta?.resolver(valor);
    setPregunta(null);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {lista.map((a) => (
          <div
            key={a.id}
            role="status"
            className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
              a.tipo === 'error'
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950 dark:text-red-200'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100'
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
      {pregunta && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
            <p className="whitespace-pre-wrap text-sm text-foreground">{pregunta.texto}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => cerrar(false)}>
                Cancelar
              </button>
              <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => cerrar(true)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
