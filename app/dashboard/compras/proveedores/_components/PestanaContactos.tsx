'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONTACTO_VACIO, INPUT_CLS, LABEL_CLS, type AlCambiarTexto, type Contacto, type Setter } from './tipos';

interface Props {
  contactos: Contacto[];
  setContactos: Setter<Contacto[]>;
  setContacto: (i: number, campo: keyof Contacto) => AlCambiarTexto;
}

export function PestanaContactos({ contactos, setContactos, setContacto }: Props) {
  return (
    <>
    <p className="text-xs text-slate-500 dark:text-slate-500">
      El formulario del cliente maneja dos contactos. Podés agregar más si
      el proveedor los tiene.
    </p>

    {contactos.map((c, i) => (
      <div key={i} className="rounded-lg border border-slate-700/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-primary">
            Contacto {i + 1}
          </span>
          {contactos.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setContactos((cs) => cs.filter((_, idx) => idx !== i))
              }
              className="text-slate-500 hover:text-red-400 h-7"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Nombre</Label>
            <Input value={c.nombre} onChange={setContacto(i, 'nombre')} className={INPUT_CLS} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Puesto / Cargo</Label>
            <Input value={c.puesto_cargo} onChange={setContacto(i, 'puesto_cargo')} className={INPUT_CLS} maxLength={100} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Teléfono</Label>
            <Input value={c.telefono} onChange={setContacto(i, 'telefono')} className={INPUT_CLS} maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Móvil</Label>
            <Input value={c.movil} onChange={setContacto(i, 'movil')} className={INPUT_CLS} maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Email</Label>
            <Input value={c.email} onChange={setContacto(i, 'email')} className={INPUT_CLS} maxLength={150} />
          </div>
        </div>
      </div>
    ))}

    <Button
      variant="outline"
      onClick={() =>
        setContactos((cs) => [...cs, CONTACTO_VACIO(cs.length + 1)])
      }
      className="border-primary/50 text-primary hover:bg-primary/10 rounded-full"
    >
      <Plus className="h-4 w-4 mr-1" /> Agregar contacto
    </Button>
    </>
  );
}
