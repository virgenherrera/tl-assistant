import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type { AgentReadRequest, AgentReadResult, AgentRuntimePort } from '#ports';
import type { FoundationBriefItem, FoundationBriefItemKind } from '#domain/foundation';
import { masterPersonaDirectives } from '#foundation-context/persona';

@Injectable()
export class LocalFoundationAgentService implements AgentRuntimePort {
  readonly name = masterPersonaDirectives.name;

  async readForFoundation(request: AgentReadRequest): Promise<AgentReadResult> {
    const sections = extractMarkdownishSections(request.rawContent);
    const items = sections
      .map((section, index) => createBriefItem({
        sourceRef: request.sourceRef,
        relativePath: request.relativePath,
        title: section.title,
        rawBody: section.body,
        index,
      }))
      .filter((item) => item.summary.length > 0);

    const finalItems = items.length > 0 ? items : request.rawContent.trim() ? [createBriefItem({
      sourceRef: request.sourceRef,
      relativePath: request.relativePath,
      title: basename(request.relativePath),
      rawBody: request.rawContent,
      index: 0,
    })] : [];

    return {
      items: finalItems,
      summary: `Se generaron ${finalItems.length} item(s) de brief desde ${request.sourceRef} usando ${this.name}.`,
    };
  }
}

function createBriefItem(input: {
  readonly sourceRef: string;
  readonly relativePath: string;
  readonly title: string;
  readonly rawBody: string;
  readonly index: number;
}): FoundationBriefItem {
  const summary = summarizeForBrief(input.rawBody);
  const title = sanitizeTitle(input.title || basename(input.relativePath));

  return {
    id: createBriefItemId(input.sourceRef, title, input.index),
    kind: inferBriefKind(`${title}\n${summary}`),
    title,
    summary,
    sourceRefs: [input.sourceRef],
  };
}

function extractMarkdownishSections(content: string): Array<{ title: string; body: string }> {
  const normalized = content.replace(/\r\n/g, '\n');
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingRegex)];

  if (matches.length === 0) {
    return splitParagraphBriefItems(normalized);
  }

  return matches
    .map((match, index) => {
      const title = match[2]?.trim() ?? `Brief item ${index + 1}`;
      const start = (match.index ?? 0) + match[0].length;
      const next = matches[index + 1]?.index ?? normalized.length;
      const body = normalized.slice(start, next).trim();
      return { title, body };
    })
    .filter((section) => section.body.length > 0);
}

function splitParagraphBriefItems(content: string): Array<{ title: string; body: string }> {
  return content
    .split(/\n{2,}/g)
    .map((body) => body.trim())
    .filter(Boolean)
    .map((body, index) => ({ title: `Brief item ${index + 1}`, body }));
}

function summarizeForBrief(rawBody: string): string {
  const compact = rawBody
    .replace(/\s+/g, ' ')
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
    .trim();
  const normalized = compact.toLowerCase();

  if (/privacidad|datos personales|sensible|arco|consentimiento|confidencial/.test(normalized)) {
    return 'Foundation source defines privacy/confidentiality obligations. Treat personal or sensitive data as local-only and cite the source instead of copying raw content.';
  }

  if (/banco|santander|n[oó]mina|cuenta|sucursal|tarjeta/.test(normalized)) {
    return 'Foundation source describes banking/payroll onboarding material. Use it as operational reference without exposing personal financial details.';
  }

  if (/formato|alta|candidato|datos personales|rfc|curp|domicilio/.test(normalized)) {
    return 'Foundation source contains onboarding/candidate data requirements. Summarize requirements and avoid leaking personally identifiable details.';
  }

  if (/debe|must|required|requerido|obligatorio|nunca|never/.test(normalized)) {
    return 'Foundation source establishes a mandatory constraint. Follow it and cite the sourceRef when explaining the decision.';
  }

  if (/delivery|entrega|tradeoff|arquitectura|architecture/.test(normalized)) {
    return 'Foundation source provides delivery or architecture guidance. Apply it as a project principle and cite the sourceRef.';
  }

  return 'Foundation source contains potentially relevant project context. Review the local extraction and cite the sourceRef before making claims.';
}

function inferBriefKind(text: string): FoundationBriefItemKind {
  const normalized = text.toLowerCase();

  if (/riesgo|risk|cuidado|sensible|confidencial|privacy|privacidad|seguridad/.test(normalized)) return 'risk';
  if (/debe|must|required|requerido|obligatorio|nunca|never|no exponer|no filtrar/.test(normalized)) return 'constraint';
  if (/decisi[oó]n|decision|acuerdo|definir|choose|elegir/.test(normalized)) return 'decision';
  if (/glosario|significa|definition|definici[oó]n|t[eé]rmino/.test(normalized)) return 'glossary';
  if (/pregunta|duda|open question|pendiente|por confirmar/.test(normalized)) return 'open-question';
  return 'principle';
}

function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim() || 'Brief item';
}

function createBriefItemId(sourceRef: string, title: string, index: number): string {
  const hash = createHash('sha256').update(`${sourceRef}:${title}:${index}`).digest('hex').slice(0, 12);
  return `brief-${hash}`;
}
