import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type RouteSegment = { value: string; dynamic: boolean };

function collectRoutes(
  dir: string,
  segments: RouteSegment[] = [],
): RouteSegment[][] {
  const routes: RouteSegment[][] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry.startsWith('(') && entry.endsWith(')')) {
        routes.push(...collectRoutes(fullPath, segments));
        continue;
      }
      const dynamic = entry.startsWith('[') && entry.endsWith(']');
      routes.push(
        ...collectRoutes(fullPath, [...segments, { value: entry, dynamic }]),
      );
      continue;
    }
    if (entry === 'page.tsx') {
      routes.push(segments);
    }
  }
  return routes;
}

export function listAppRoutes(appDir: string): RouteSegment[][] {
  return collectRoutes(appDir);
}

export function routeExists(
  routes: RouteSegment[][],
  pathname: string,
): boolean {
  const targetSegments = pathname.split('/').filter(Boolean);
  return routes.some((route) => {
    if (route.length !== targetSegments.length) return false;
    return route.every(
      (segment, i) => segment.dynamic || segment.value === targetSegments[i],
    );
  });
}

export function extractSectionIds(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  return [...source.matchAll(/\bid="([a-zA-Z0-9-]+)"/g)].map(
    (match) => match[1],
  );
}
