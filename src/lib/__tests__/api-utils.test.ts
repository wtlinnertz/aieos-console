import { describe, it, expect } from 'vitest';
import { errorResponse, badRequest } from '@/lib/api-utils';
import {
  DependenciesNotMetError,
  StepAlreadyFrozenError,
  StepNotInProgressError,
  StepNotDraftError,
  StepNotValidatedPassError,
  StepNotEditableError,
  ProjectAlreadyInitializedError,
  StateNotFoundError,
  StepNotFoundError,
  FlowDefinitionNotFoundError,
} from '@/lib/services/errors';

describe('errorResponse', () => {
  it('maps DependenciesNotMetError to 409', async () => {
    const err = new DependenciesNotMetError('deps not met');
    const res = errorResponse(err);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('deps not met');
    expect(body.code).toBe('DEPENDENCIES_NOT_MET');
  });

  it('maps StepAlreadyFrozenError to 409', async () => {
    const res = errorResponse(new StepAlreadyFrozenError('already frozen'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already frozen');
  });

  it('maps StepNotInProgressError to 409', async () => {
    const res = errorResponse(new StepNotInProgressError('not in progress'));
    expect(res.status).toBe(409);
  });

  it('maps StepNotDraftError to 409', async () => {
    const res = errorResponse(new StepNotDraftError('not draft'));
    expect(res.status).toBe(409);
  });

  it('maps StepNotValidatedPassError to 409', async () => {
    const res = errorResponse(new StepNotValidatedPassError('not validated'));
    expect(res.status).toBe(409);
  });

  it('maps StepNotEditableError to 409', async () => {
    const res = errorResponse(new StepNotEditableError('not editable'));
    expect(res.status).toBe(409);
  });

  it('maps ProjectAlreadyInitializedError to 409', async () => {
    const res = errorResponse(new ProjectAlreadyInitializedError('already init'));
    expect(res.status).toBe(409);
  });

  it('maps StateNotFoundError to 404', async () => {
    const res = errorResponse(new StateNotFoundError('no state'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('no state');
    expect(body.code).toBe('STATE_NOT_FOUND');
  });

  it('maps StepNotFoundError to 404', async () => {
    const res = errorResponse(new StepNotFoundError('no step'));
    expect(res.status).toBe(404);
  });

  it('maps FlowDefinitionNotFoundError to 404', async () => {
    const res = errorResponse(new FlowDefinitionNotFoundError('no flow'));
    expect(res.status).toBe(404);
  });

  it('maps unknown errors to 500 without stack traces', async () => {
    const err = new Error('something broke');
    const res = errorResponse(err);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body).not.toHaveProperty('stack');
  });

  it('maps non-Error values to 500', async () => {
    const res = errorResponse('string error');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(body).not.toHaveProperty('stack');
  });

  it('never includes stack traces in conflict responses', async () => {
    const err = new DependenciesNotMetError('deps not met');
    const res = errorResponse(err);
    const body = await res.json();
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});

describe('badRequest', () => {
  it('returns 400 with provided message', async () => {
    const res = badRequest('missing field');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing field');
    expect(body.code).toBe('BAD_REQUEST');
  });
});
