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

test('incumbents stream without settling the request until its final result', async () => {
  const client = new SolveWorkerClient(() => new FakeWorker() as never);
  const updates: SolveResult[] = [];
  let settled = false;
  const pending = client.solve({} as ResolvedCatalogModel, buildRequest(), {
    attempt: 'primary', onProgress: progress => { if (progress.result) updates.push(progress.result); },
  });
  void pending.then(() => { settled = true; });
  const worker = FakeWorker.instances[0];
  const catalogMessage = worker.postedMessages[0] as { requestId: number; catalogVersion: string };
  worker.onmessage?.({ data: { ...catalogMessage, type: 'set_catalog_result' } });
  await flushMicrotasks();
  const solveMessage = worker.postedMessages[1] as { requestId: number };
  for (let i = 0; i < 2; i++) {
    const result = { ...buildResult(), status: 'feasible' as const };
    worker.onmessage?.({ data: { type: 'incumbent', requestId: solveMessage.requestId, result } });
  }
  await flushMicrotasks();
  expect(updates).toHaveLength(2);
  expect(settled).toBe(false);
  worker.onmessage?.({ data: { type: 'solve_result', requestId: solveMessage.requestId, result: buildResult() } });
  await expect(pending).resolves.toMatchObject({ status: 'optimal' });
});

test('finishing a superseded promise cannot disable cancellation of its replacement', async () => {
  const client = new SolveWorkerClient(() => new FakeWorker() as never);
  const first = client.solve({} as ResolvedCatalogModel, buildRequest(), { attempt: 'primary' }).catch(error => error);
  const second = client.solve({} as ResolvedCatalogModel, buildRequest(), { attempt: 'primary' }).catch(error => error);
  await flushMicrotasks();
  client.cancelActiveSolve();
  expect(FakeWorker.instances[1].terminated).toBe(true);
  await first;
  await expect(second).resolves.toBeInstanceOf(Error);
});

test('cancelling after catalog acknowledgement prevents dispatch and worker recreation', async () => {
  const client = new SolveWorkerClient(() => new FakeWorker() as never);
  const pending = client.solve({} as ResolvedCatalogModel, buildRequest(), { attempt: 'primary' });
  const worker = FakeWorker.instances[0];
  const catalogMessage = worker.postedMessages[0] as { requestId: number; catalogVersion: string };
  worker.onmessage?.({ data: { ...catalogMessage, type: 'set_catalog_result' } });
  client.cancelActiveSolve();
  await expect(pending).rejects.toThrow('cancelled');
  expect(worker.terminated).toBe(true);
  expect(worker.postedMessages).toHaveLength(1);
  expect(FakeWorker.instances).toHaveLength(1);
});

test('a superseded catalog acknowledgement cannot dispatch into its replacement worker', async () => {
  const client = new SolveWorkerClient(() => new FakeWorker() as never);
  const catalog = {} as ResolvedCatalogModel;
  const first = client.solve(catalog, buildRequest(), { attempt: 'primary' });
  const firstWorker = FakeWorker.instances[0];
  const message = firstWorker.postedMessages[0] as { requestId: number; catalogVersion: string };
  firstWorker.onmessage?.({ data: { ...message, type: 'set_catalog_result' } });
  const second = client.solve(catalog, buildRequest(), { attempt: 'primary' });
  await expect(first).rejects.toThrow('superseded');
  expect(FakeWorker.instances[1].postedMessages).toHaveLength(1);
  client.cancelActiveSolve();
  await expect(second).rejects.toThrow('cancelled');
});

test('stopping a streaming solve terminates native work and ignores queued messages', async () => {
  const client = new SolveWorkerClient(() => new FakeWorker() as never);
  const progress = jest.fn();
  const pending = client.solve({} as ResolvedCatalogModel, buildRequest(), { attempt: 'primary', onProgress: progress });
  const worker = FakeWorker.instances[0];
  const catalogMessage = worker.postedMessages[0] as { requestId: number; catalogVersion: string };
  worker.onmessage?.({ data: { ...catalogMessage, type: 'set_catalog_result' } });
  await flushMicrotasks();
  const solveMessage = worker.postedMessages[1] as { requestId: number };
  const incumbent = { type: 'incumbent', requestId: solveMessage.requestId, result: buildResult() };
  const deliver = worker.onmessage!;
  deliver({ data: incumbent });
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ result: incumbent.result }));
  const count = progress.mock.calls.length;
  client.cancelActiveSolve();
  expect(worker.terminated).toBe(true);
  deliver({ data: incumbent });
  deliver({ data: { ...incumbent, type: 'solve_result' } });
  expect(progress).toHaveBeenCalledTimes(count);
  await expect(pending).rejects.toThrow('cancelled');
});
