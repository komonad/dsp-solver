import { copyText, type CopyTextEnvironment } from '../src/web/shared/copyText';

function createTextareaMock() {
  return {
    value: '',
    style: {} as Record<string, string>,
    setAttribute: jest.fn(),
    select: jest.fn(),
    setSelectionRange: jest.fn(),
    remove: jest.fn(),
  };
}

test('copyText uses navigator.clipboard when available', async () => {
  const writeText = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);

  await expect(
    copyText('request-json', {
      navigator: {
        clipboard: { writeText },
      },
    })
  ).resolves.toBe(true);

  expect(writeText).toHaveBeenCalledWith('request-json');
});

test('copyText falls back to execCommand when clipboard write fails', async () => {
  const textarea = createTextareaMock();
  const focus = jest.fn();
  const env: CopyTextEnvironment = {
    navigator: {
      clipboard: {
        writeText: jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error('denied')),
      },
    },
    document: {
      activeElement: { focus },
      body: {
        appendChild: jest.fn(),
      },
      createElement: jest.fn(() => textarea),
      execCommand: jest.fn(() => true),
    },
  };

  await expect(copyText('request-json', env)).resolves.toBe(true);

  expect(textarea.select).toHaveBeenCalledTimes(1);
  expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 'request-json'.length);
  expect(textarea.remove).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledTimes(1);
});

test('copyText reports failure when clipboard and execCommand are unavailable', async () => {
  await expect(copyText('request-json', {})).resolves.toBe(false);
});
