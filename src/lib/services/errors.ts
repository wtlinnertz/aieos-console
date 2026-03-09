export class PathViolationError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'PathViolationError';
    this.path = path;
  }
}

export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class ReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadError';
  }
}

export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteError';
  }
}

export class DirectoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirectoryNotFoundError';
  }
}

export class FlowDefinitionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowDefinitionNotFoundError';
  }
}

export class FlowDefinitionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowDefinitionParseError';
  }
}

export class StepNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepNotFoundError';
  }
}

export class InputFileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputFileNotFoundError';
  }
}

export class ProjectAlreadyInitializedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectAlreadyInitializedError';
  }
}

export class StateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateNotFoundError';
  }
}

export class StateCorruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateCorruptedError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export class EngagementRecordNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngagementRecordNotFoundError';
  }
}

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export class LlmTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmTimeoutError';
  }
}

export class LlmResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmResponseParseError';
  }
}

export class LlmStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmStreamError';
  }
}

export class ValidationResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationResponseParseError';
  }
}

export class DependenciesNotMetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependenciesNotMetError';
  }
}

export class StepAlreadyFrozenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepAlreadyFrozenError';
  }
}

export class StepNotInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepNotInProgressError';
  }
}

export class StepNotDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepNotDraftError';
  }
}

export class StepNotValidatedPassError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepNotValidatedPassError';
  }
}

export class StepNotEditableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepNotEditableError';
  }
}
