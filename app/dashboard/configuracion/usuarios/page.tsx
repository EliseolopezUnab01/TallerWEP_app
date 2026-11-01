'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { BarraPantalla } from '@/components/barra-pantalla';
import { Toast, pedir, useAviso } from '@/app/dashboard/taller/_components/comun';
import { MODULOS_PERMISO, PERMISOS } from '@/lib/permisos-constantes';
import { useSesion } from '@/lib/sesion-cliente';
import { UI } from '@/lib/ui';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  idrol: number | null;
  rol: string | null;
  activo: number;
  ultimo_acceso: string | null;
}

interface Rol {
  idrol: number;
  nombre: string;
  descripcion: string | null;
  es_admin: boolean;
  usuarios: number;
  permisos: string[];
}

const USUARIO_VACIO = { id: 0, nombre: '', email: '', idrol: '', password: '', activo: true };
type FormUsuario = typeof USUARIO_VACIO;

export default function UsuariosPage() {
  const { aviso, notificar } = useAviso();
  const { puede, sesion } = useSesion();
  const editable = puede('usuarios.editar');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [form, setForm] = useState<FormUsuario | null>(null);
  const [rolSel, setRolSel] = useState<number | null>(null);
  const [rolForm, setRolForm] = useState<{ nombre: string; descripcion: string; permisos: Set<string> } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([pedir('/api/usuarios'), pedir('/api/roles')]);
      setUsuarios(u.usuarios);
      setRoles(r.roles);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const rolActual = useMemo(() => roles.find((r) => r.idrol === rolSel) ?? null, [roles, rolSel]);

  const elegirRol = (r: Rol | null) => {
    setRolSel(r?.idrol ?? null);
    setRolForm(r ? { nombre: r.nombre, descripcion: r.descripcion ?? '', permisos: new Set(r.permisos) } : { nombre: '', descripcion: '', permisos: new Set() });
  };

  const guardarUsuario = async () => {
    if (!form) return;
    try {
      const cuerpo = {
        id: form.id || undefined,
        nombre: form.nombre,
        email: form.email,
        idrol: Number(form.idrol) || null,
        activo: form.activo,
        password: form.password || undefined,
      };
      const r = await pedir('/api/usuarios', form.id ? 'PUT' : 'POST', cuerpo);
      notificar('ok', r.mensaje);
      setForm(null);
      cargar();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const guardarRol = async () => {
    if (!rolForm) return;
    try {
      const cuerpo = { idrol: rolSel ?? undefined, nombre: rolForm.nombre, descripcion: rolForm.descripcion, permisos: [...rolForm.permisos] };
      const r = await pedir('/api/roles', rolSel ? 'PUT' : 'POST', cuerpo);
      notificar('ok', r.mensaje);
      if (!rolSel && r.idrol) setRolSel(r.idrol);
      cargar();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const borrarRol = async () => {
    if (!rolSel || !rolActual) return;
    if (!window.confirm(`¿Eliminar el rol ${rolActual.nombre}?`)) return;
    try {
      const r = await pedir(`/api/roles?id=${rolSel}`, 'DELETE');
      notificar('ok', r.mensaje);
      setRolSel(null);
      setRolForm(null);
      cargar();
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  const alternarPermiso = (clave: string) => {
    if (!rolForm) return;
    const permisos = new Set(rolForm.permisos);
    if (permisos.has(clave)) permisos.delete(clave);
    else permisos.add(clave);
    setRolForm({ ...rolForm, permisos });
  };

  const rolBloqueado = rolActual?.es_admin ?? false;

  return (
    <DashboardLayout>
      <div className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}>
        <BarraPantalla modulo="Configuración" titulo="Usuarios y roles" />

        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
          {/* Usuarios */}
          <section className={`${UI.densePanel} flex min-h-0 flex-col`}>
            <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
              <span>Usuarios</span>
              {editable && (
                <button type="button" className={UI.denseBtnPrimary} onClick={() => setForm({ ...USUARIO_VACIO })}>
                  <UserPlus className="h-3.5 w-3.5" /> Nuevo usuario
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className={UI.denseTable}>
                <thead>
                  <tr>
                    <th className={UI.denseTh}>Nombre</th>
                    <th className={UI.denseTh}>Correo</th>
                    <th className={UI.denseTh}>Rol</th>
                    <th className={UI.denseTh}>Estado</th>
                    <th className={UI.denseTh}>Último acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className={`${UI.denseRow} ${form?.id === u.id ? UI.denseRowActive : ''}`}
                      onClick={() =>
                        editable &&
                        setForm({ id: u.id, nombre: u.nombre, email: u.email, idrol: String(u.idrol ?? ''), password: '', activo: Number(u.activo) === 1 })
                      }
                    >
                      <td className={UI.denseTd}>
                        {u.nombre}
                        {u.id === sesion?.id && <span className="ml-1 text-[10px] text-primary">(usted)</span>}
                      </td>
                      <td className={UI.denseTd}>{u.email}</td>
                      <td className={UI.denseTd}>{u.rol ?? <span className={UI.textWarn}>Sin rol</span>}</td>
                      <td className={UI.denseTd}>
                        {Number(u.activo) === 1 ? <span className={UI.textStockOk}>Activo</span> : <span className={UI.textFaint}>Inactivo</span>}
                      </td>
                      <td className={`${UI.denseTd} ${UI.denseMono}`}>{u.ultimo_acceso ? String(u.ultimo_acceso).slice(0, 16).replace('T', ' ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {form && (
              <div className="border-t border-border p-3">
                <div className="mb-2 text-xs font-semibold">{form.id ? `Editar ${form.nombre}` : 'Nuevo usuario'}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Nombre</span>
                    <input className={UI.denseInput} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Correo (usuario)</span>
                    <input className={UI.denseInput} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Rol</span>
                    <select className={UI.denseSelect} value={form.idrol} onChange={(e) => setForm({ ...form, idrol: e.target.value })}>
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.idrol} value={r.idrol}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>{form.id ? 'Nueva contraseña (vacío = no cambia)' : 'Contraseña'}</span>
                    <input className={UI.denseInput} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </label>
                  {form.id > 0 && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                      Activo (si se desactiva, no puede iniciar sesión)
                    </label>
                  )}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" className={UI.denseBtn} onClick={() => setForm(null)}>
                    Cancelar
                  </button>
                  <button type="button" className={UI.denseBtnPrimary} onClick={guardarUsuario}>
                    <Save className="h-3.5 w-3.5" /> Guardar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Roles */}
          <section className={`${UI.densePanel} flex min-h-0 flex-col`}>
            <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
              <span>Roles y permisos</span>
              {editable && (
                <button type="button" className={UI.denseBtnPrimary} onClick={() => elegirRol(null)}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo rol
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
              {roles.map((r) => (
                <button
                  key={r.idrol}
                  type="button"
                  className={`${r.idrol === rolSel ? UI.denseBtnPrimary : UI.denseBtn}`}
                  onClick={() => elegirRol(r)}
                >
                  {r.es_admin && <ShieldCheck className="h-3.5 w-3.5" />}
                  {r.nombre}
                  <span className="opacity-60">({r.usuarios})</span>
                </button>
              ))}
            </div>

            {rolForm ? (
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Nombre del rol</span>
                    <input
                      className={UI.denseInput}
                      disabled={rolBloqueado || !editable}
                      value={rolForm.nombre}
                      onChange={(e) => setRolForm({ ...rolForm, nombre: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={UI.denseLabel}>Descripción</span>
                    <input
                      className={UI.denseInput}
                      disabled={rolBloqueado || !editable}
                      value={rolForm.descripcion}
                      onChange={(e) => setRolForm({ ...rolForm, descripcion: e.target.value })}
                    />
                  </label>
                </div>
                {rolBloqueado && <p className={`${UI.note} mt-2`}>El rol Administrador tiene todos los permisos y no se edita.</p>}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {MODULOS_PERMISO.map((m) => (
                    <div key={m} className="rounded-md border border-border p-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m}</div>
                      {PERMISOS.filter((p) => p.modulo === m).map((p) => (
                        <label key={p.clave} className="flex items-center gap-2 py-0.5 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            disabled={rolBloqueado || !editable}
                            checked={rolBloqueado || rolForm.permisos.has(p.clave)}
                            onChange={() => alternarPermiso(p.clave)}
                          />
                          {p.etiqueta}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                {editable && !rolBloqueado && (
                  <div className="mt-3 flex justify-end gap-2">
                    {rolSel && (
                      <button type="button" className={UI.denseBtnDanger} onClick={borrarRol}>
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar rol
                      </button>
                    )}
                    <button type="button" className={UI.denseBtnPrimary} onClick={guardarRol}>
                      <Save className="h-3.5 w-3.5" /> Guardar rol
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="p-4 text-xs text-muted-foreground">Elija un rol para ver o editar sus permisos.</p>
            )}
          </section>
        </div>
      </div>
      <Toast aviso={aviso} />
    </DashboardLayout>
  );
}
