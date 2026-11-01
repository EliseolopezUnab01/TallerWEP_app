'use client';

import type { ReactNode } from 'react';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';

/** Barra superior de una pantalla: módulo / título a la izquierda, acciones y usuario a la derecha. */
export function BarraPantalla({ modulo, titulo, children }: { modulo: string; titulo: string; children?: ReactNode }) {
  return (
    <div className={`${UI.navbar} shrink-0`}>
      <div className="flex items-center gap-3">
        <span className={UI.navLabel}>{modulo}</span>
        <span className={UI.navDivider} />
        <span className={UI.navTitle}>{titulo}</span>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <NotificationDropdown />
        <UserDropdown />
      </div>
    </div>
  );
}
