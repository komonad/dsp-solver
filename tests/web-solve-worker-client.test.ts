import type { ResolvedCatalogModel } from '../src/catalog';
import type { SolveRequest, SolveResult } from '../src/solver';
import { SolveWorkerClient } from '../src/web/workbench/solveWorkerClientCore';

type WorkerMessageHandler = ((event: { data: unknown }) => void) | null;
type WorkerErrorHandler = ((event: { message?: string }) => void) | null;

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: WorkerMessageHandler = null;
  onerror: WorkerErrorHandler = null;
  terminated = false;
  postedMessages: unknown[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const originalWorker = globalThis.Worker;

function buildRequest(): SolveRequest {
  return {
    targets: [{ itemId: '6006', ratePerMin: 60 }],
    objective: 'min_power',
    balancePolicy: 'force_balance',
    rawInputItemIds: [],
  };
}

function buildResult(): SolveResult {
  return {
    status: 'optimal',
    resolvedRawInputItemIds: [],
    targets: [],
    recipePlans: [],
    externalInputs: [],
    surplusOutputs: [],
    buildingSummary: [],
    powerSummary: {
      activePowerMW: 0,
      roundedPlacementPowerMW: 0,
    },
    itemBalance: [],
    diagnostics: {
      messages: [],
      infoMessages: [],
      unmetPreferences: [],
    },
  };
}

async function flushMicrotasks(rounds = 5): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
});

afterEach(() => {
  globalThis.Worker = originalWorker;
});

test('stale worker errors do not abort a newer solve session', async () => {
  const client = new SolveWorkerClient(
    () => new FakeWorker() as unknown as Pick<Worker, 'onmessage' | 'onerror' | 'postMessage' | 'terminate'>
  );
  const catalog = { id: 'catalog' } as unknown as ResolvedCatalogModel;
  const request = buildRequest();

  const firstSolvePromise = client.solve(catalog, request, {
    attempt: 'primary',
  });
  const firstWorker = FakeWorker.instances[0];
  expect(firstWorker).toBeDefined();
  const firstCatalogMessage = firstWorker.postedMessages[0] as {
    requestId: number;
    catalogVersion: string;
  };

  firstWorker.onmessage?.({
    data: {
      type: 'set_catalog_result',
      requestId: firstCatalogMessage.requestId,
      catalogVersion: firstCatalogMessage.catalogVersion,
    },
  });
  await flushMicrotasks();

  const secondSolvePromise = client.solve(catalog, request, {
    attempt: 'primary',
  });
  const secondWorker = FakeWorker.instances[1];
  expect(secondWorker).toBeDefined();
  expect(firstWorker.terminated).toBe(true);

  const secondCatalogMessage = secondWorker.postedMessages[0] as {
    requestId: number;
    catalogVersion: string;
  };
  secondWorker.onmessage?.({
    data: {
      type: 'set_catalog_result',
      requestId: secondCatalogMessage.requestId,
      catalogVersion: secondCatalogMessage.catalogVersion,
    },
  });
  await flushMicrotasks();

  firstWorker.onerror?.({
    message: 'RuntimeError: Aborted(). Build with -sASSERTIONS for more info.',
  });
  await flushMicrotasks();
  expect(secondWorker.terminated).toBe(false);

  const secondSolveMessage = secondWorker.postedMessages[1] as {
    requestId: number;
  };
  secondWorker.onmessage?.({
    data: {
      type: 'solve_result',
      requestId: secondSolveMessage.requestId,
      result: buildResult(),
    },
  });

  await expect(firstSolvePromise).rejects.toThrow('Solve superseded by a newer request.');
  await expect(secondSolvePromise).resolves.toMatchObject({
    status: 'optimal',
  });
}, 10_000);
