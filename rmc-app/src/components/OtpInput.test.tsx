import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import OtpInput from './OtpInput';

// A tiny controlled wrapper so the boxes reflect the value the parent owns,
// mirroring how Login drives the component.
function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('OtpInput', () => {
  it('renders six digit boxes', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);
  });

  it('auto-advances and fires onComplete once every box is filled', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await user.keyboard('123456');

    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(boxes[5].value).toBe('6');
  });

  it('distributes a pasted code across the boxes', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await user.paste('987654');

    expect(boxes.map(b => b.value).join('')).toBe('987654');
    expect(onComplete).toHaveBeenCalledWith('987654');
  });

  it('ignores non-numeric characters', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await user.keyboard('1a2b');
    expect(boxes[0].value).toBe('1');
    expect(boxes[1].value).toBe('2');
  });

  it('clears the current digit on backspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes[0].focus();
    await user.keyboard('12');
    await user.keyboard('{Backspace}');
    // After typing "12", focus is on box 3 (empty); backspace walks back and
    // clears the previous filled digit.
    expect(boxes.map(b => b.value).join('')).toBe('1');
  });
});
