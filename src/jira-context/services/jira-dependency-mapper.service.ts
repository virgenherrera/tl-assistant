import { Injectable } from '@nestjs/common';
import type { JiraDependencyEdge, JiraDependencyMap, JiraIssueBrief } from '#jira-context/domain';

@Injectable()
export class JiraDependencyMapperService {
  map(issues: readonly JiraIssueBrief[], generatedAt: string): JiraDependencyMap {
    const edges: JiraDependencyEdge[] = [];

    for (const issue of issues) {
      for (const dependencyRef of issue.dependencyRefs) {
        edges.push({
          fromRef: issue.ref,
          toRef: dependencyRef,
          type: 'issue-link',
          direction: 'outward',
        });
      }
      if (issue.parentKey) {
        edges.push({
          fromRef: issue.ref,
          toRef: `jira://issue/${issue.parentKey}`,
          type: 'parent',
          direction: 'outward',
        });
      }
    }

    return {
      schemaVersion: 'tl-assistant.jira.dependencies.v1',
      generatedAt,
      edges,
    };
  }
}
