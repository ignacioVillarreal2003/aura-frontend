import { Routes } from '@angular/router';
import { ChatPageComponent } from './chat-page/chat-page';

export const chatShellRoutes: Routes = [
  {
    path: '',
    component: ChatPageComponent,
    children: [
      { path: '', redirectTo: 'chat-home', pathMatch: 'full' },
      {
        path: 'chat-home',
        loadComponent: () =>
          import('./components/chat-home/chat-home').then((m) => m.ChatHomeComponent),
      },
      {
        path: 'chats',
        loadComponent: () =>
          import('./components/chat-search/chat-search.component').then(
            (m) => m.ChatSearchComponent
          ),
      },
      {
        path: 'tools',
        loadComponent: () =>
          import('./components/herramientas/herramientas-shell.component').then(
            (m) => m.HerramientasShellComponent
          ),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./components/herramientas/herramientas-hub.component').then(
                (m) => m.HerramientasHubComponent
              ),
          },
          {
            path: 'resumen-extenso',
            loadComponent: () =>
              import('./components/herramientas/resumen-extenso-tool.component').then(
                (m) => m.ResumenExtensoToolComponent
              ),
          },
          {
            path: 'puntos-clave',
            loadComponent: () =>
              import('./components/herramientas/herramienta-placeholder.component').then(
                (m) => m.HerramientaPlaceholderComponent
              ),
            data: {
              toolTitle: 'Puntos clave',
              toolDescription:
                'Extracción breve de las ideas principales del documento, pensada para una lectura rápida.',
            },
          },
          {
            path: 'preguntas-estudio',
            loadComponent: () =>
              import('./components/herramientas/herramienta-placeholder.component').then(
                (m) => m.HerramientaPlaceholderComponent
              ),
            data: {
              toolTitle: 'Preguntas de estudio',
              toolDescription:
                'Preguntas generadas a partir del contenido para repasar o evaluar comprensión.',
            },
          },
          {
            path: 'extraccion-datos',
            loadComponent: () =>
              import('./components/herramientas/herramienta-placeholder.component').then(
                (m) => m.HerramientaPlaceholderComponent
              ),
            data: {
              toolTitle: 'Extracción de datos',
              toolDescription:
                'Identificación y organización de datos relevantes (fechas, cifras, entidades, etc.).',
            },
          },
          {
            path: 'informes',
            loadComponent: () =>
              import('./components/herramientas/tool-generator-page.component').then(
                (m) => m.ToolGeneratorPageComponent
              ),
            data: {
              initialKind: 'SITREP',
              pageTitle: 'Generador de Informes',
              pageSubtitle:
                'Redactá informes militares estandarizados (SITREP, INTSUM, OPORD) con asistencia de IA y exportalos en PDF o Markdown.',
            },
          },
          {
            path: 'checklist',
            loadComponent: () =>
              import('./components/herramientas/tool-generator-page.component').then(
                (m) => m.ToolGeneratorPageComponent
              ),
            data: {
              initialKind: 'CHECKLIST',
              pageTitle: 'Checklist desde Procedimiento',
              pageSubtitle:
                'Convertí manuales y SOPs en checklists interactivas verificables durante la operación.',
            },
          },
          {
            path: 'asistentes',
            loadComponent: () =>
              import('./components/herramientas/asistentes-hub.component').then(
                (m) => m.AsistentesHubComponent
              ),
          },
        ],
      },
      {
        path: 'chat/:id',
        loadComponent: () =>
          import('./components/chat-session/chat-session').then((m) => m.ChatSessionComponent),
      },
    ],
  },
];
