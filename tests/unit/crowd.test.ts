import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { WALK_AREA } from '../../src/street/areas';
import { buildGraph, Crowd, type Agent, type Graph } from '../../src/street/crowd';
import type { P, XinyiData } from '../../src/street/types';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));
const g = buildGraph(data.footways, WALK_AREA);
const FAR: P = [1e6, 1e6];

function reachable(graph: Graph) {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const e of graph.adjacent[queue.pop()!]) {
      const { a, b } = graph.edges[e];
      for (const n of [a, b]) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
  }
  return seen.size;
}

function distanceToGraph(graph: Graph, { x, z }: { x: number; z: number }) {
  let best = Infinity;
  for (const { a, b } of graph.edges) {
    const [ax, az] = graph.nodes[a];
    const [bx, bz] = graph.nodes[b];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
    best = Math.min(best, Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)));
  }
  return best;
}

function minPairDistance(agents: readonly Agent[]) {
  let min = Infinity;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      min = Math.min(min, Math.hypot(agents[i].x - agents[j].x, agents[i].z - agents[j].z));
    }
  }
  return min;
}

describe('buildGraph', () => {
  test('the graph is one connected network of real footways', () => {
    expect(g.edges.reduce((s, e) => s + e.length, 0)).toBeGreaterThan(8000);
    expect(reachable(g)).toBe(g.nodes.length);
  });
});

describe('Crowd', () => {
  test('walkers stay on the network and inside the walk area', () => {
    const crowd = new Crowd(g, 90, 1);
    for (let i = 0; i < 1800; i++) crowd.step(1 / 30, FAR);
    for (const a of crowd.agents) {
      expect(a.x).toBeGreaterThanOrEqual(WALK_AREA.x0 - 3);
      expect(a.x).toBeLessThanOrEqual(WALK_AREA.x1 + 3);
      expect(a.z).toBeGreaterThanOrEqual(WALK_AREA.z0 - 3);
      expect(a.z).toBeLessThanOrEqual(WALK_AREA.z1 + 3);
      expect(distanceToGraph(g, a)).toBeLessThan(2.5);
    }
  });

  test('nobody walks through anybody over two minutes', () => {
    const crowd = new Crowd(g, 90, 2);
    let min = Infinity;
    for (let i = 0; i < 3600; i++) {
      crowd.step(1 / 30, FAR);
      min = Math.min(min, minPairDistance(crowd.agents));
    }
    expect(min).toBeGreaterThanOrEqual(0.4);
    // 3600 steps of all pairs: a few seconds, more on a slow CI runner.
  }, 30_000);

  test('walkers yield to the visitor and then turn around', () => {
    const crowd = new Crowd(g, 90, 5);
    crowd.step(1 / 30, FAR);
    const walker = crowd.agents.find((a) => a.moving)!;
    // The visitor stands 0.5 m straight ahead of the walker (heading 0 faces north, -z; see Agent).
    const ahead = (d: number): P => [walker.x - Math.sin(walker.heading) * d, walker.z - Math.cos(walker.heading) * d];
    const visitor = ahead(0.5);
    const gap = () => Math.hypot(walker.x - visitor[0], walker.z - visitor[1]);
    const before = gap();
    for (let i = 0; i < 30; i++) crowd.step(1 / 30, visitor);
    expect(gap()).toBeGreaterThanOrEqual(before - 1e-6);
    for (let i = 0; i < 90; i++) crowd.step(1 / 30, visitor);
    expect(gap()).toBeGreaterThan(before + 0.5);
  });

  test('about 15% stand, the rest walk, and the crowd keeps moving', () => {
    const crowd = new Crowd(g, 90, 3);
    crowd.step(1 / 30, FAR);
    const standing = crowd.agents.filter((a) => !a.moving).length;
    expect(standing).toBeGreaterThanOrEqual(9);
    expect(standing).toBeLessThanOrEqual(20);
    const start = crowd.agents.map((a) => [a.x, a.z]);
    for (let i = 0; i < 60; i++) crowd.step(1 / 30, FAR);
    const moved = crowd.agents.filter((a, i) => Math.hypot(a.x - start[i][0], a.z - start[i][1]) > 0.5).length;
    expect(moved).toBeGreaterThan(90 / 2);
  });

  test('same seed, same crowd', () => {
    const one = new Crowd(g, 90, 4);
    const two = new Crowd(g, 90, 4);
    for (let i = 0; i < 300; i++) {
      one.step(1 / 30, FAR);
      two.step(1 / 30, FAR);
    }
    expect(one.agents).toEqual(two.agents);
  });
});
