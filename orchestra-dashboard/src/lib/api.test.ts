import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchExecutions,
  fetchExecution,
  createExecution,
  fetchAgents,
  fetchFindings,
  checkHealth,
} from './api.ts';

const mockFetch = vi.fn();

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  function mockFetchSuccess(data: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });
  }

  function mockFetchError(status: number, statusText: string) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
    });
  }

  describe('fetchExecutions', () => {
    it('fetches from /api/executions', async () => {
      const mockData = [{ id: 'exec-001' }];
      mockFetchSuccess(mockData);

      const result = await fetchExecutions();

      expect(mockFetch).toHaveBeenCalledWith('/api/executions/', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('throws on error response', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(fetchExecutions()).rejects.toThrow('API error: 500 Internal Server Error');
    });
  });

  describe('fetchExecution', () => {
    it('fetches a single execution by id', async () => {
      const mockData = { id: 'exec-001', status: 'running' };
      mockFetchSuccess(mockData);

      const result = await fetchExecution('exec-001');

      expect(mockFetch).toHaveBeenCalledWith('/api/executions/exec-001', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('encodes the id in the URL', async () => {
      const mockData = { id: 'exec with spaces' };
      mockFetchSuccess(mockData);

      await fetchExecution('exec with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/executions/exec%20with%20spaces',
        expect.any(Object),
      );
    });

    it('throws on 404 response', async () => {
      mockFetchError(404, 'Not Found');

      await expect(fetchExecution('nonexistent')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  describe('createExecution', () => {
    it('posts to /api/executions with JSON body', async () => {
      const params = {
        workflow: 'full-pipeline' as const,
        task: 'Build feature',
        model: 'opus',
        target: './src',
        projectSource: { type: 'local' as const, path: '/tmp/project' },
      };
      const mockResponse = { id: 'exec-new', ...params, status: 'queued' };
      mockFetchSuccess(mockResponse);

      const result = await createExecution(params);

      expect(mockFetch).toHaveBeenCalledWith('/api/executions/', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify(params),
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws on server error', async () => {
      mockFetchError(422, 'Unprocessable Entity');

      await expect(
        createExecution({
          workflow: 'full-pipeline',
          task: '',
          model: '',
          target: '',
          projectSource: { type: 'local', path: '' },
        }),
      ).rejects.toThrow('API error: 422 Unprocessable Entity');
    });
  });

  describe('fetchAgents', () => {
    it('fetches from /api/agents', async () => {
      const mockData = [{ role: 'developer', name: 'Dev Agent' }];
      mockFetchSuccess(mockData);

      const result = await fetchAgents();

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('throws on error response', async () => {
      mockFetchError(503, 'Service Unavailable');

      await expect(fetchAgents()).rejects.toThrow('API error: 503 Service Unavailable');
    });
  });

  describe('fetchFindings', () => {
    it('fetches from /api/findings without params', async () => {
      const mockData = [{ id: 'finding-001' }];
      mockFetchSuccess(mockData);

      const result = await fetchFindings();

      expect(mockFetch).toHaveBeenCalledWith('/api/findings/', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('appends severity query parameter', async () => {
      mockFetchSuccess([]);

      await fetchFindings({ severity: 'critical' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findings/?severity=critical',
        expect.any(Object),
      );
    });

    it('appends type query parameter', async () => {
      mockFetchSuccess([]);

      await fetchFindings({ type: 'security' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findings/?type=security',
        expect.any(Object),
      );
    });

    it('appends status query parameter', async () => {
      mockFetchSuccess([]);

      await fetchFindings({ status: 'open' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findings/?status=open',
        expect.any(Object),
      );
    });

    it('appends multiple query parameters', async () => {
      mockFetchSuccess([]);

      await fetchFindings({ severity: 'high', type: 'quality', status: 'resolved' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findings/?severity=high&type=quality&status=resolved',
        expect.any(Object),
      );
    });

    it('skips undefined parameters', async () => {
      mockFetchSuccess([]);

      await fetchFindings({ severity: undefined, type: 'performance' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/findings/?type=performance',
        expect.any(Object),
      );
    });
  });

  describe('checkHealth', () => {
    it('fetches from /api/health', async () => {
      const mockData = { status: 'ok' };
      mockFetchSuccess(mockData);

      const result = await checkHealth();

      expect(mockFetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
      expect(result).toEqual(mockData);
    });

    it('throws on error response', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(checkHealth()).rejects.toThrow('API error: 500 Internal Server Error');
    });
  });

  describe('apiFetch headers', () => {
    it('always includes Content-Type application/json header', async () => {
      mockFetchSuccess({});

      await checkHealth();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });
});
