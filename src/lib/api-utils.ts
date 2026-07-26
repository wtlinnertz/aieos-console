import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

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

export function errorResponse(err: unknown): NextResponse<ErrorBody> {
  if (!(err instanceof Error)) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  const code = getErrorCode(err);

  if (CONFLICT_ERRORS.has(err.name)) {
    return NextResponse.json({ error: err.message, code }, { status: 409 });
  }

  if (NOT_FOUND_ERRORS.has(err.name)) {
    return NextResponse.json({ error: err.message, code }, { status: 404 });
  }

  if (UNAVAILABLE_ERRORS.has(err.name)) {
    return NextResponse.json({ error: err.message, code }, { status: 503 });
  }

  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 },
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
