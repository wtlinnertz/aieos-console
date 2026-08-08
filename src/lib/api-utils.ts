import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { logError } from '@/lib/logger';

interface ErrorBody {
  error: string;
  code: string;
}

const CONFLICT_ERRORS = new Set([
  'DependenciesNotMetError',
  'StepAlreadyFrozenError',
  'StepNotInProgressError',
  'StepNotDraftError',
  'StepNotValidatedPassError',
  'StepNotEditableError',
  'ProjectAlreadyInitializedError',
  'PrinciplesInputsUnsupportedError',
  // G-22: an illegal lifecycle move is a state conflict the operator can act
  // on, not an internal fault. It was absent here, so the G-22 freeze failure
  // surfaced as a bare 500 with its message discarded — which is why
  // diagnosing a one-line transition table took reading four files.
  'InvalidTransitionError',
]);

const NOT_FOUND_ERRORS = new Set([
  'StateNotFoundError',
  'StepNotFoundError',
  'FlowDefinitionNotFoundError',
  'KitNotInManifestError',
]);

// FR-023 (D4): manifest/config failures are fail-closed and operator-fixable
// — 503, with the structured code preserved (e.g. MANIFEST_VERSION_SKEW).
const UNAVAILABLE_ERRORS = new Set([
  'ManifestNotFoundError',
  'ManifestParseError',
  'ManifestVersionSkewError',
  'RepoCheckoutMissingError',
  'ConventionResolutionError',
]);

function getErrorCode(err: Error): string {
  return err.name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/_ERROR$/, '');
}

/**
 * G-22 fix (3): every mapped error is recorded before its response is built.
 *
 * The 500 branch is the one that matters most — it discards `err.message`, so
 * if it is not logged here the failure is recorded nowhere at all. That is
 * precisely what happened with G-22: a freeze succeeded on disk, threw while
 * being recorded, and returned a bare "Internal server error" with a silent
 * terminal. Diagnosing a one-line transition table cost four file reads.
 */
function respond(
  status: number,
  body: ErrorBody,
  err: Error | null,
): NextResponse<ErrorBody> {
  logError('api_error', {
    name: err?.name ?? 'NonError',
    code: body.code,
    status,
    message: err?.message ?? body.error,
  });
  return NextResponse.json(body, { status });
}

export function errorResponse(err: unknown): NextResponse<ErrorBody> {
  if (!(err instanceof Error)) {
    return respond(
      500,
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      null,
    );
  }

  const code = getErrorCode(err);

  // G-22: the ADR-0003 harness seam carries its own structured code
  // (hash_mismatch, bad_status, harness_failed...). Every one of them used to
  // collapse into the generic 500 below with `code` thrown away, so the seam
  // that G-18 and G-19 both lived in could not report which failure occurred.
  // 502: the harness is an upstream dependency, not this process. Matched by
  // name rather than instanceof to keep api-utils free of a service import,
  // consistent with the sets above.
  if (err.name === 'HarnessFreezeError') {
    const harnessCode = (err as Error & { code?: string }).code;
    return respond(
      502,
      {
        error: err.message,
        code: (harnessCode ?? 'harness_failed').toUpperCase(),
      },
      err,
    );
  }

  if (CONFLICT_ERRORS.has(err.name)) {
    return respond(409, { error: err.message, code }, err);
  }

  if (NOT_FOUND_ERRORS.has(err.name)) {
    return respond(404, { error: err.message, code }, err);
  }

  if (UNAVAILABLE_ERRORS.has(err.name)) {
    return respond(503, { error: err.message, code }, err);
  }

  return respond(
    500,
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    err,
  );
}

export function getProjectDir(): string {
  return loadConfig().projectDir;
}

export function badRequest(message: string): NextResponse<ErrorBody> {
  return NextResponse.json(
    { error: message, code: 'BAD_REQUEST' },
    { status: 400 },
  );
}
