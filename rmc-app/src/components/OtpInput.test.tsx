import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import OtpInput from './OtpInput';

// A tiny controlled wrapper so the box reflects the value the parent owns,
// mirroring how Login drives the component.
function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('OtpInput', () => {
  it('renders a single code box that accepts one-time-code autofill', () => {
    render(<Harness />);
    const box = screen.getByRole('textbox') as HTMLInputElement;
    expect(box).toBeInTheDocument();
    expect(box.getAttribute('autocomplete')).toBe('one-time-code');
    expect(box.getAttribute('inputmode')).toBe('numeric');
  });

  it('fires onComplete once the full code is typed', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    const box = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(box);
    await user.keyboard('123456');

    expect(box.value).toBe('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('accepts a pasted code', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    const box = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(box);
    await user.paste('987654');

    expect(box.value).toBe('987654');
    expect(onComplete).toHaveBeenCalledWith('987654');
  });

  it('ignores non-numeric characters and caps at the code length', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(box);
    await user.keyboard('1a2b3c4d5e6f7');
    expect(box.value).toBe('123456');
  });

  it('deletes digits on backspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(box);
    await user.keyboard('12');
    await user.keyboard('{Backspace}');
    expect(box.value).toBe('1');
  });
});
