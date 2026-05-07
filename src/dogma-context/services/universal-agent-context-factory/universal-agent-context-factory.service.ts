import { Injectable } from '@nestjs/common';
import type { UniversalAgentContext } from '#domain/dogma';
import type { AgentContextFactoryPort } from '#ports';
import { masterPersonaDirectives } from '#dogma-context/persona';

@Injectable()
export class UniversalAgentContextFactoryService implements AgentContextFactoryPort {
  create(input: { readonly generatedAt: string }): UniversalAgentContext {
    return {
      schemaVersion: 'tl-assistant.agent-context.v2',
      generatedAt: input.generatedAt,
      persona: masterPersonaDirectives,
      compatibility: {
        format: 'bootstrap-markdown-and-json',
        target: 'any-agent',
        instructions: [
          'Leer dogma-brief.md primero: contiene el brief semántico accionable y referencias foundation://.',
          'Usar source-map.json para ubicar fuentes por ref sin exponer full paths locales.',
          'Usar extractions.json sólo en entorno local confiable cuando el brief no alcance.',
          'No pegar contenido crudo de foundation docs en outputs externos.',
          'Mantener español neutral por defecto salvo instrucción explícita de otro idioma.',
        ],
      },
      sourceMapRef: 'source-map.json',
      dogmaBriefRef: 'dogma-brief.md',
    };
  }
}
