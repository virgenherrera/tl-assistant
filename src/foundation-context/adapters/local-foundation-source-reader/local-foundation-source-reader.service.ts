import { Injectable } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, resolve } from 'node:path';
import fg from 'fast-glob';
import { from, lastValueFrom, mergeMap, Observable, of, toArray } from 'rxjs';
import type { FoundationSourceReader, FoundationSource } from '#ports';

const ignoredPatterns = [
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/desktop.ini',
  '**/*.ini',
  '**/~$*',
  '**/.git/**',
  '**/node_modules/**',
  '**/.tl-assistant/**',
  '**/.local-data/**',
];

@Injectable()
export class LocalFoundationSourceReaderService implements FoundationSourceReader {
  readonly sourceKind = 'local' as const;

  public discoverSources$(rootPath: string): Observable<FoundationSource> {
    const normalizedRoot = toAbsoluteLocalPath(rootPath);

    return from(stat(normalizedRoot)).pipe(
      mergeMap((rootStat) => {
        if (rootStat.isFile()) {
          return of(toFoundationSource(normalizedRoot, rootStat));
        }

        if (!rootStat.isDirectory()) {
          return of();
        }

        const stream = fg.stream(['**/*'], {
          cwd: normalizedRoot,
          absolute: true,
          onlyFiles: true,
          unique: true,
          dot: false,
          ignore: ignoredPatterns,
          suppressErrors: true,
          followSymbolicLinks: false,
        }) as AsyncIterable<string | Buffer>;

        return from(stream).pipe(
          mergeMap(async (entry) => {
            const sourcePath = toAbsoluteLocalPath(entry.toString());
            const sourceStat = await stat(sourcePath);
            return toFoundationSource(sourcePath, sourceStat);
          }, 8),
        );
      }),
    );
  }

  public async discoverSources(rootPath: string): Promise<readonly FoundationSource[]> {
    const sources = await lastValueFrom(this.discoverSources$(rootPath).pipe(toArray()), { defaultValue: [] });
    return [...sources].sort((a, b) => a.path.localeCompare(b.path));
  }
}

function toFoundationSource(sourcePath: string, sourceStat: { size: number; mtimeMs: number }): FoundationSource {
  return {
    kind: 'local',
    path: sourcePath,
    extension: extname(sourcePath).toLowerCase(),
    size: sourceStat.size,
    mtimeMs: sourceStat.mtimeMs,
  };
}

function toAbsoluteLocalPath(input: string): string {
  return resolve(input.replace(/^~(?=$|\/)/, homedir()));
}
