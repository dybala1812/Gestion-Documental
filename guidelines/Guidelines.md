# Identidad Visual Institucional - NOVA

Este documento define la referencia oficial de color para interfaces, componentes y piezas visuales del ecosistema NOVA.

## Objetivo

Mantener coherencia visual institucional, mejorar reconocimiento de marca y asegurar consistencia entre proyectos web, módulos y servicios integrados.

## Paleta Oficial

| Token | Valor | Nombre | Uso recomendado |
|---|---|---|---|
| `beige` | `#f3ede1` | Fondo principal | Portadas, fondos de seccion y plantillas base |
| `beigeAlt` | `#ede6d8` | Fondo alterno | Bandas secundarias y separadores visuales |
| `navy` | `#1e3a5f` | Azul institucional | Titulos, encabezados y elementos de autoridad |
| `orange` | `#e8740e` | Naranja de accion | Llamados a la accion y resaltados de prioridad |
| `gold` | `#c89b14` | Dorado institucional | Subtitulos, indicadores y jerarquia secundaria |
| `text` | `#2c3e50` | Texto principal | Contenido normativo y cuerpo documental |
| `muted` | `#6b7a8d` | Texto de apoyo | Notas, subtitulos y metadatos |
| `card` | `#ffffff` | Superficie | Tablas, paneles y contenedores |
| `border` | `rgba(30,58,95,0.09)` | Borde tenue | Separadores y delimitadores |

## Reglas de aplicacion

1. Todo nuevo desarrollo debe usar primero estos tokens antes de introducir colores nuevos.
2. No usar colores hardcodeados en componentes reutilizables cuando exista token equivalente.
3. Boton primario: `navy`; accion secundaria o highlight: `orange`; acento informativo: `gold`.
4. El texto de lectura continua debe priorizar `text`; metadatos y apoyos en `muted`.
5. Los fondos base deben alternar `beige` y `beigeAlt` para jerarquia visual suave.
6. Validar contraste y legibilidad en desktop y mobile.

## Alcance

Aplica para frontend web, modulos embebidos, reportes visuales y vistas de politicas/documentacion institucional.
