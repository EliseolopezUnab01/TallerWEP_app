'use client';

import { AlertCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CUENTA_VACIA, INPUT_CLS, LABEL_CLS, type AlCambiarTexto, type Cuenta, type ModoFicha, type Setter } from './tipos';

interface Props {
  modo: ModoFicha;
  cuentas: Cuenta[];
  cuentaEditando: Cuenta | null;
  setCuentaEditando: Setter<Cuenta | null>;
  setCuenta: (campo: keyof Cuenta) => AlCambiarTexto;
  guardarCuenta: () => void;
  eliminarCuenta: (idcuenta?: number) => void;
}

export function PestanaCuentas({ modo, cuentas, cuentaEditando, setCuentaEditando, setCuenta, guardarCuenta, eliminarCuenta }: Props) {
  return (
    <>
    {modo === 'nuevo' && (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Guardá primero el proveedor para poder agregarle cuentas.
      </div>
    )}

    {/* Lista de cuentas */}
    {cuentas.length > 0 && (
      <div className="space-y-2">
        {cuentas.map((c) => (
          <div
            key={c.idcuenta}
            className="rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-background px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{c.numero_cuenta}</span>
                {c.moneda && (
                  <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                    {c.moneda}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {c.banco || 'Sin banco'}
                {c.beneficiario ? ` · ${c.beneficiario}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost" size="icon"
                onClick={() => setCuentaEditando({ ...c })}
                className="text-slate-400 hover:text-primary h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={() => eliminarCuenta(c.idcuenta)}
                className="text-slate-400 hover:text-red-400 h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}

    {!cuentaEditando ? (
      <Button
        variant="outline"
        disabled={modo === 'nuevo'}
        onClick={() => setCuentaEditando(CUENTA_VACIA())}
        className="border-primary/50 text-primary hover:bg-primary/10 rounded-full disabled:opacity-40"
      >
        <Plus className="h-4 w-4 mr-1" /> Agregar cuenta bancaria
      </Button>
    ) : (
      <div className="rounded-lg border border-primary/40 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-primary">
            {cuentaEditando.idcuenta ? 'Editar cuenta' : 'Nueva cuenta'}
          </span>
          <Button
            variant="ghost" size="sm"
            onClick={() => setCuentaEditando(null)}
            className="text-slate-500 hover:text-slate-300 h-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className={LABEL_CLS}>
              Número de cuenta <span className="text-red-400">*</span>
            </Label>
            <Input
              value={cuentaEditando.numero_cuenta}
              onChange={setCuenta('numero_cuenta')}
              className={`${INPUT_CLS} font-mono`}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Moneda</Label>
            <Input
              value={cuentaEditando.moneda}
              onChange={setCuenta('moneda')}
              className={INPUT_CLS}
              placeholder="USD, EURO..."
              maxLength={20}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className={LABEL_CLS}>Beneficiario</Label>
          <Input
            value={cuentaEditando.beneficiario}
            onChange={setCuenta('beneficiario')}
            className={INPUT_CLS}
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label className={LABEL_CLS}>Dirección del beneficiario</Label>
          <Input
            value={cuentaEditando.direccion_beneficiario}
            onChange={setCuenta('direccion_beneficiario')}
            className={INPUT_CLS}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Banco</Label>
            <Input
              value={cuentaEditando.banco}
              onChange={setCuenta('banco')}
              className={INPUT_CLS}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Dirección del banco</Label>
            <Input
              value={cuentaEditando.direccion_banco}
              onChange={setCuenta('direccion_banco')}
              className={INPUT_CLS}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Cód. ABA (USA)</Label>
            <Input
              value={cuentaEditando.codigo_aba}
              onChange={setCuenta('codigo_aba')}
              className={`${INPUT_CLS} font-mono`}
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>SWIFT / BIC</Label>
            <Input
              value={cuentaEditando.codigo_swift}
              onChange={setCuenta('codigo_swift')}
              className={`${INPUT_CLS} font-mono`}
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>IBAN (Europa)</Label>
            <Input
              value={cuentaEditando.codigo_iban}
              onChange={setCuenta('codigo_iban')}
              className={`${INPUT_CLS} font-mono`}
              maxLength={60}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className={LABEL_CLS}>Comentarios / Instrucciones</Label>
          <Textarea
            value={cuentaEditando.comentarios}
            onChange={setCuenta('comentarios')}
            rows={3}
            className={INPUT_CLS}
          />
        </div>

        <Button
          onClick={guardarCuenta}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full"
        >
          <Save className="h-4 w-4 mr-1" /> Guardar cuenta
        </Button>
      </div>
    )}
    </>
  );
}
