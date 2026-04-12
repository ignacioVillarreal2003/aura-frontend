/**
 * Única fuente de verdad para el menú lateral del área de usuario (rutas + etiquetas).
 * Las rutas bajo `/user` deben coincidir con `path`.
 */
export const USER_AREA_NAV_LINKS = [
  { path: 'profile', label: 'Mi perfil', icon: 'pi pi-user' },
  { path: 'notifications', label: 'Notificaciones', icon: 'pi pi-bell' },
  { path: 'general', label: 'General', icon: 'pi pi-cog' },
  { path: 'privacy', label: 'Privacidad', icon: 'pi pi-shield' },
  { path: 'security', label: 'Seguridad', icon: 'pi pi-lock' },
  { path: 'data-control', label: 'Control de datos', icon: 'pi pi-database' },
] as const;

export type UserAreaNavPath = (typeof USER_AREA_NAV_LINKS)[number]['path'];
