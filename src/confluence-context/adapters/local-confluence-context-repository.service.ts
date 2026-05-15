import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfluencePageDetail, ConfluenceSearchResult } from '#confluence-context/domain';

@Injectable()
export class LocalConfluenceContextRepositoryService {
  async savePage(page: ConfluencePageDetail, outputDir: string): Promise<readonly string[]> {
    const pagesDir = join(outputDir, 'pages');
    await mkdir(pagesDir, { recursive: true });
    const jsonPath = join(pagesDir, `${page.id}.json`);
    const mdPath = join(pagesDir, `${page.id}.md`);

    await writeFile(jsonPath, `${JSON.stringify(page, null, 2)}\n`, 'utf8');
    await writeFile(mdPath, renderPageMarkdown(page), 'utf8');
    return [jsonPath, mdPath];
  }

  async saveSearch(result: ConfluenceSearchResult, outputDir: string): Promise<readonly string[]> {
    await mkdir(outputDir, { recursive: true });
    const safeName = result.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'search';
    const jsonPath = join(outputDir, `search-${safeName}.json`);
    const mdPath = join(outputDir, `search-${safeName}.md`);

    await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await writeFile(mdPath, renderSearchMarkdown(result), 'utf8');
    return [jsonPath, mdPath];
  }
}

function renderPageMarkdown(page: ConfluencePageDetail): string {
  return [
    `# ${page.title}`,
    '',
    `Ref: \`${page.ref}\``,
    page.webUrl ? `URL: ${page.webUrl}` : undefined,
    page.status ? `Status: ${page.status}` : undefined,
    page.version === undefined ? undefined : `Version: ${page.version}`,
    '',
    page.bodyText || '_Sin contenido textual extraíble._',
  ].filter((line): line is string => line !== undefined).join('\n').trimEnd() + '\n';
}

function renderSearchMarkdown(result: ConfluenceSearchResult): string {
  const items = result.results.map((item, index) => [
    `## ${index + 1}. ${item.title}`,
    '',
    item.ref ? `Ref: \`${item.ref}\`` : undefined,
    item.url ? `URL: ${item.url}` : undefined,
    item.spaceKey ? `Space: ${item.spaceKey}` : undefined,
    item.excerpt ? `Excerpt: ${item.excerpt}` : undefined,
  ].filter((line): line is string => line !== undefined).join('\n')).join('\n\n');

  return [
    '# Confluence Search Results',
    '',
    `Generated at: ${result.generatedAt}`,
    `Query: ${result.query}`,
    `CQL: \`${result.cql}\``,
    '',
    items || '_Sin resultados._',
  ].join('\n').trimEnd() + '\n';
}
