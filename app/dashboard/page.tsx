import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Settings } from 'lucide-react';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400">Bienvenido al panel de control del Taller Web</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Usuarios</CardTitle>
              <Users className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-50">1</div>
              <p className="text-xs text-slate-400">
                Usuarios registrados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Reportes</CardTitle>
              <FileText className="h-4 w-4 text-violet-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-50">5</div>
              <p className="text-xs text-slate-400">
                Reportes generados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Configuración</CardTitle>
              <Settings className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-50">3</div>
              <p className="text-xs text-slate-400">
                Ajustes activos
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/80 border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-slate-200">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">
              Bienvenido al sistema de Taller Web. Aquí puedes gestionar todos los aspectos de tu aplicación.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}