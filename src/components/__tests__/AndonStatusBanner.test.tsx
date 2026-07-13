import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { AndonStatusBanner } from '../AndonStatusBanner';

afterEach(() => cleanup());

describe('AndonStatusBanner', () => {
  it('renders nothing for non-fault states', () => {
    const { container } = render(<AndonStatusBanner status="FROZEN" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a HALTED banner with a resume affordance', () => {
    const onResume = vi.fn();
    render(<AndonStatusBanner status="HALTED" onResume={onResume} />);
    expect(screen.getByTestId('andon-banner')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('andon-title')).toHaveTextContent('Halted');
    fireEvent.click(screen.getByTestId('andon-resume'));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('renders a FAULTED banner with a clear affordance', () => {
    const onClearFault = vi.fn();
    render(<AndonStatusBanner status="FAULTED" onClearFault={onClearFault} />);
    expect(screen.getByTestId('andon-title')).toHaveTextContent('Faulted');
    expect(screen.queryByTestId('andon-resume')).toBeNull();
    fireEvent.click(screen.getByTestId('andon-clear'));
    expect(onClearFault).toHaveBeenCalledOnce();
  });

  it('notes that a resume/clear is not a freeze', () => {
    render(<AndonStatusBanner status="HALTED" />);
    expect(screen.getByTestId('andon-banner')).toHaveTextContent(/not a freeze/i);
  });
});
