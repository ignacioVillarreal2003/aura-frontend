export interface NavLink {
  path: string;
  label: string;
  icon: string;
}

export const USER_AREA_NAV_LINKS: NavLink[] = [
  { path: 'profile', label: 'Perfil', icon: 'pi pi-user' },
  { path: 'invitations', label: 'Invitaciones', icon: 'pi pi-envelope' },
  { path: 'notifications', label: 'Notificaciones', icon: 'pi pi-bell' },
  { path: 'general', label: 'General', icon: 'pi pi-cog' },
  { path: 'privacy', label: 'Privacidad', icon: 'pi pi-shield' },
  { path: 'security', label: 'Seguridad', icon: 'pi pi-lock' },
  { path: 'data-control', label: 'Control de datos', icon: 'pi pi-database' },
];
