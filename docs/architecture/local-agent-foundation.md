# Agente maestro local + foundation context

## Decisión

La aplicación usa Nest standalone + `nest-commander` para exponer comandos CLI con módulos, servicios e inyección de dependencias.

Toda información leída se media localmente mediante una abstracción de agente en la capa de aplicación.

Los adapters pueden hacer I/O crudo, pero la interpretación, extracción de brief, generación de contexto y refresco de foundation pasan por el flujo del agente maestro local.

```txt
FOUNDATION_DOCS_PATH opcional
  -> FoundationDocsConfig valida env y mapea la source local si existe
  -> LocalFoundationSourceReaderService descubre fuentes en modo sólo lectura
  -> RefreshFoundationService coordina
  -> LocalFoundationAgentService interpreta
  -> LocalFoundationRepositoryService escribe artifacts locales fuera del discovery root
```

## Feature actual

La feature actual refresca foundation context desde una source local configurada con `FOUNDATION_DOCS_PATH`, que puede ser un archivo o un directorio local.

```bash
FOUNDATION_DOCS_PATH="/Users/me/Library/CloudStorage/OneDrive - Company/Foundation Docs" pnpm foundation:refresh
```

`FOUNDATION_DOCS_PATH` es opcional para arrancar la app y para comandos no relacionados como Jira. `foundation:refresh` sí requiere al menos una source foundation configurada; en esta fase sólo existe `foundation.local`.

Para rutas con espacios, acentos, paréntesis o caracteres raros de OneDrive/Windows, siempre quoteá el valor:

```env
FOUNDATION_DOCS_PATH="/Users/me/Library/CloudStorage/OneDrive - Company/Foundation Docs"
```

## Contrato de discovery

- Sin `FOUNDATION_DOCS_PATH`, `foundation.local` queda no configurado.
- Si `FOUNDATION_DOCS_PATH` existe en env, Zod valida que no venga vacío.
- La capa de config valida que el path exista, sea legible y sea archivo o directorio.
- `foundation:refresh` falla con error tipado si no hay ninguna source foundation disponible.
- Si es directorio, se crawlea recursivamente con profundidad indeterminada.
- No hay límite hardcodeado de profundidad.
- No se siguen symlinks.
- El discovery root es **sólo lectura**: nunca escribir, renombrar, mover, normalizar, limpiar ni borrar archivos dentro de `FOUNDATION_DOCS_PATH`.
- Los artifacts generados viven fuera del discovery root, por defecto bajo `.tl-assistant/foundation/`.

Si algún día performance exige limitar profundidad o tamaño, tiene que ser configuración explícita del usuario, no una decisión escondida en código.

## Fuentes foundation

La interfaz interna está preparada para multi-source:

- `foundation.local` usa `FOUNDATION_DOCS_PATH` y refs `foundation://local/ruta/relativa.ext`.
- `foundation.confluence` queda reservado para una implementación futura con refs `foundation://confluence/{spaceKey}/{pageId}`.

## Formatos soportados

El scanner crawlea todo lo que no esté ignorado, estilo gitignore. Luego el parser decide si puede leer cada archivo:

- Markdown/texto/JSON/YAML/CSV/TSV/log: lectura UTF-8 nativa.
- DOCX: `mammoth` vía import dinámico.
- XLS/XLSX/XLSM: `xlsx` vía import dinámico.
- PDF: `pdf-parse` vía import dinámico.

Formatos no soportados generan un aviso explícito para agregar un adapter Node. No instalar ni ejecutar tools random del sistema contra el discovery path. La política base es denylist/ignore, no whitelist de extensiones en config.

## Salida local

El refresco genera, por defecto:

```txt
.tl-assistant/foundation/source-map.json
.tl-assistant/foundation/extractions.json
.tl-assistant/foundation/foundation-brief.json
.tl-assistant/foundation/foundation-brief.md
.tl-assistant/foundation/agent-context.json
.tl-assistant/foundation/AGENT_FOUNDATION_CONTEXT.md
```

`.tl-assistant/` está git-ignored porque el foundation context derivado puede contener información sensible.

## Política de idioma

El contexto universal del agente usa español por defecto.

- El agente debe hablar español con el usuario.
- Outputs externos también van en español neutral por defecto: code reviews, comentarios de Jira, reportes, resúmenes, decisiones y recomendaciones.
- Otro idioma sólo se usa si el usuario lo pide explícitamente para un output concreto.
