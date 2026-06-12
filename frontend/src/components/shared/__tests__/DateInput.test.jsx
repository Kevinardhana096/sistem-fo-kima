import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DateInput from '../DateInput';

describe('DateInput', () => {
  it('hanya membuka date picker saat tombol kalender diklik, bukan saat field text diklik', async () => {
    const showPicker = vi.fn();
    const originalShowPicker = window.HTMLInputElement.prototype.showPicker;
    window.HTMLInputElement.prototype.showPicker = showPicker;

    try {
      render(<DateInput value="" onChange={vi.fn()} />);

      await userEvent.click(screen.getByPlaceholderText('DD/MM/YYYY'));
      expect(showPicker).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /buka kalender/i }));
      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (originalShowPicker) {
        window.HTMLInputElement.prototype.showPicker = originalShowPicker;
      } else {
        delete window.HTMLInputElement.prototype.showPicker;
      }
    }
  });
});
