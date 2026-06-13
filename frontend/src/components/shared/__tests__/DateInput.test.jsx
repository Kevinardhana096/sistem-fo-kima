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

  it('menampilkan bulan dan tahun saat mode month-year tidak fokus', async () => {
    render(<DateInput value="2025-05-01" onChange={vi.fn()} displayMode="month-year" />);

    const input = screen.getByDisplayValue('Mei 2025');
    expect(input).toBeInTheDocument();

    await userEvent.click(input);
    expect(input).toHaveValue('01/05/2025');

    await userEvent.tab();
    expect(input).toHaveValue('Mei 2025');
  });
});
