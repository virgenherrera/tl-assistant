import { Injectable } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, resolve } from 'node:path';
import fg from 'fast-glob';
import { from, lastValueFrom, mergeMap, Observable, of, toArray } from 'rxjs';
import type { FoundationDocReaderPort, FoundationDocSource } from '#ports';

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
export class LocalFoundationDocReaderService implements FoundationDocReaderPort {
  public discoverSources$(rootPath: string): Observable<FoundationDocSource> {
    const normalizedRoot = toAbsoluteLocalPath(rootPath);

    return from(stat(normalizedRoot)).pipe(
      mergeMap((rootStat) => {
        if (rootStat.isFile()) {
          return of(toFoundationDocSource(normalizedRoot, rootStat));
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
            return toFoundationDocSource(sourcePath, sourceStat);
          }, 8),
        );
      }),
    );
  }

  public async discoverSources(rootPath: string): Promise<readonly FoundationDocSource[]> {
    const sources = await lastValueFrom(this.discoverSources$(rootPath).pipe(toArray()), { defaultValue: [] });
    return [...sources].sort((a, b) => a.path.localeCompare(b.path));
  }
}

function toFoundationDocSource(sourcePath: string, sourceStat: { size: number; mtimeMs: number }): FoundationDocSource {
  return {
    path: sourcePath,
    extension: extname(sourcePath).toLowerCase(),
    size: sourceStat.size,
    mtimeMs: sourceStat.mtimeMs,
  };
}

function toAbsoluteLocalPath(input: string): string {
  return resolve(input.replace(/^~(?=$|\/)/, homedir()));
}
