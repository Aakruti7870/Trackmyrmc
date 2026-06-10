import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from './toast-provider';
import { useToast } from './toast';

function Trigger() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('First message', 'info')}>show-first</button>
      <button onClick={() => showToast('Second message', 'success')}>show-second</button>
      <button onClick={() => showToast('Third message', 'error')}>show-third</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  );
}

describe('ToastProvider', () => {
  it('stacks multiple toasts', () => {
    renderProvider();
    fireEvent.click(screen.getByText('show-first'));
    fireEvent.click(screen.getByText('show-second'));
    fireEvent.click(screen.getByText('show-third'));

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();

    const toasts = document.querySelectorAll('[data-toast-type]');
    expect(toasts).toHaveLength(3);
    expect(toasts[0].getAttribute('data-toast-type')).toBe('info');
    expect(toasts[1].getAttribute('data-toast-type')).toBe('success');
    expect(toasts[2].getAttribute('data-toast-type')).toBe('error');
  });

  it('removes a toast when its × button is clicked', () => {
    renderProvider();
    fireEvent.click(screen.getByText('show-first'));
    fireEvent.click(screen.getByText('show-second'));

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();

    const dismissButtons = screen.getAllByText('×');
    fireEvent.click(dismissButtons[0]);

    expect(screen.queryByText('First message')).not.toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('auto-dismisses a toast after 4 seconds', () => {
    vi.useFakeTimers();
    try {
      renderProvider();
      act(() => {
        screen.getByText('show-first').click();
      });
      expect(screen.getByText('First message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(screen.getByText('First message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('First message')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
