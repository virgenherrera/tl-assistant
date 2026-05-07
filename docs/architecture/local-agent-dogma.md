# Agente maestro local + refresco de dogma

## Decisión

La aplicación usa Nest standalone + `nest-commander` para exponer comandos CLI con módulos, servicios e inyección de dependencias.

Toda información leída se media localmente mediante una abstracción de agente en la capa de aplicación.

Los adapters pueden hacer I/O crudo, pero la interpretación, extracción de directivas, generación de contexto y refresco de dogma pasan por el flujo del agente maestro local.

```txt
FOUNDATION_DOCS_PATH
  -> AppConfigService valida env y mapea a config.foundationDocs.discoveryRootPath
  -> LocalFoundationDocReaderService descubre y lee fuentes en modo sólo lectura
  -> RefreshDogmaService coordina
  -> LocalDogmaAgentService interpreta
  -> LocalDogmaRepositoryService escribe artefactos locales fuera del discovery root
```

## Feature actual

La primera feature refresca dogma desde `FOUNDATION_DOCS_PATH`, que puede ser un archivo o, normalmente, un directorio local.

```bash
FOUNDATION_DOCS_PATH="/Users/me/Library/CloudStorage/OneDrive - Company/Foundation Docs" pnpm dogma:refresh
```

Para rutas con espacios, acentos, paréntesis o caracteres raros de OneDrive/Windows, siempre quoteá el valor:

```env
FOUNDATION_DOCS_PATH="/Users/me/Library/CloudStorage/OneDrive - Company/Foundation Docs"
```

## Contrato de discovery

- `FOUNDATION_DOCS_PATH` es obligatorio.
- El schema Zod transforma `FOUNDATION_DOCS_PATH` a `foundationDocsPath`.
- La capa de config valida que el path exista, sea legible y sea archivo o directorio.
- El resto de la app consume `config.foundationDocs.discoveryRootPath`, no el nombre crudo del env.
- Si es directorio, se crawlea recursivamente con profundidad indeterminada.
- No hay límite hardcodeado de profundidad.
- No se siguen symlinks.
- El discovery root es **sólo lectura**: nunca escribir, renombrar, mover, normalizar, limpiar ni borrar archivos dentro de `FOUNDATION_DOCS_PATH`.
- Los artefactos generados viven fuera del discovery root, por defecto bajo `.tl-assistant/`.

Si algún día performance exige limitar profundidad o tamaño, tiene que ser configuración explícita del usuario, no una decisión escondida en código.

## Formatos soportados

El scanner crawlea todo lo que no esté ignorado, estilo gitignore. Luego el parser decide si puede leer cada archivo:

- Markdown/texto/JSON/YAML/CSV/TSV/log: lectura UTF-8 nativa.
- DOCX: `mammoth`.
- XLS/XLSX/XLSM: `xlsx`.
- PDF: `pdf-parse`.

Formatos no soportados generan un aviso explícito para agregar un adapter Node. No instalar ni ejecutar tools random del sistema contra el discovery path. La política base es denylist/ignore, no whitelist de extensiones en config.

## Salida local

El refresco genera, por defecto:

```txt
.tl-assistant/dogma/dogma.json
.tl-assistant/dogma/dogma.md
.tl-assistant/dogma/agent-context.json
.tl-assistant/dogma/AGENT_CONTEXT.md
```

`.tl-assistant/` está git-ignored porque el dogma derivado puede contener información sensible.

## Política de idioma

El contexto universal del agente usa español por defecto.

- El agente debe hablar español con el usuario.
- Outputs externos también van en español neutral por defecto: code reviews, comentarios de Jira, reportes, resúmenes, decisiones y recomendaciones.
- Otro idioma sólo se usa si el usuario lo pide explícitamente para un output concreto.
