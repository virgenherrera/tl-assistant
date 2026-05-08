import { Injectable } from '@nestjs/common';
import type { JiraBoardBrief, JiraDependencyMap, JiraIssueBrief, JiraSprintBrief, JiraTlBrief, JiraTlBriefItem } from '#jira-context/domain';

@Injectable()
export class JiraBriefService {
  create(input: {
    readonly generatedAt: string;
    readonly board: JiraBoardBrief;
    readonly activeSprint?: JiraSprintBrief;
    readonly issues: readonly JiraIssueBrief[];
    readonly dependencies: JiraDependencyMap;
  }): JiraTlBrief {
    const items: JiraTlBriefItem[] = [];
    const unassigned = input.issues.filter((issue) => !issue.assignee);
    const stale = input.issues.filter((issue) => issue.stale);
    const blocked = input.issues.filter((issue) => issue.dependencyRefs.length > 0);

    if (unassigned.length > 0) {
      items.push(createItem('unassigned', 'Issues sin assignee', `${unassigned.length} issue(s) no tienen assignee asignado.`, unassigned.map((issue) => issue.ref)));
    }
    if (stale.length > 0) {
      items.push(createItem('stale', 'Issues sin movimiento reciente', `${stale.length} issue(s) parecen stale por fecha de actualización mayor a 5 días.`, stale.map((issue) => issue.ref)));
    }
    if (blocked.length > 0) {
      items.push(createItem('dependencies', 'Dependencias visibles', `${blocked.length} issue(s) tienen links/dependencias detectadas.`, [...new Set(blocked.flatMap((issue) => [issue.ref, ...issue.dependencyRefs]))]));
    }

    const activeSprintText = input.activeSprint ? `Sprint activo: ${input.activeSprint.name}.` : 'No se detectó sprint activo.';

    return {
      schemaVersion: 'tl-assistant.jira.tl-brief.v1',
      generatedAt: input.generatedAt,
      summary: `${input.board.name}: ${input.issues.length} issue(s) visibles. ${activeSprintText}`,
      risks: items,
      refs: [input.board.ref, ...(input.activeSprint ? [input.activeSprint.ref] : []), ...input.issues.map((issue) => issue.ref)],
    };
  }
}

function createItem(id: string, title: string, summary: string, sourceRefs: readonly string[]): JiraTlBriefItem {
  return { id, title, summary, sourceRefs };
}
