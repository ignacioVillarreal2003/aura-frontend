import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ToolTile = {
  path: string;
  title: string;
  description: string;
  icon: string;
};

@Component({
  selector: 'app-herramientas-hub',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './herramientas-hub.component.html',
  styleUrl: './herramientas-hub.component.css',
})
export class HerramientasHubComponent {
  readonly tools: ToolTile[] = [
    {
      path: 'resumen-extenso',
      title: 'Resumen extenso',
      description: 'Subí un documento y obtené un resumen detallado.',
      icon: 'pi pi-align-left',
    },
    {
      path: 'puntos-clave',
      title: 'Puntos clave',
      description: 'Extracción breve de ideas principales del texto.',
      icon: 'pi pi-bolt',
    },
    {
      path: 'preguntas-estudio',
      title: 'Preguntas de estudio',
      description: 'Generación de preguntas para repasar el contenido.',
      icon: 'pi pi-question-circle',
    },
    {
      path: 'extraccion-datos',
      title: 'Extracción de datos',
      description: 'Estructurar información relevante del documento.',
      icon: 'pi pi-table',
    },
    {
      path: 'informes',
      title: 'Informes Estandarizados',
      description: 'Generá SITREP, INTSUM u OPORD con asistencia de IA y exportá en PDF o Markdown.',
      icon: 'pi pi-file-edit',
    },
    {
      path: 'checklist',
      title: 'Checklist desde Procedimiento',
      description: 'Convertí manuales y SOPs en checklists interactivas verificables durante la operación.',
      icon: 'pi pi-list-check',
    },
    {
      path: 'asistentes',
      title: 'Asistentes Especializados',
      description: 'Iniciá sesiones con asistentes configurados para tareas específicas, sin configurar nada.',
      icon: 'pi pi-android',
    },
  ];
}
