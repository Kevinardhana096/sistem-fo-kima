import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IspAdminFormPage from '../IspAdminFormPage';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  default: {
    isps: {
      create: vi.fn(),
      update: vi.fn(),
    },
    ispEntryPoints: {
      replaceForIsp: vi.fn().mockResolvedValue([]),
    },
  },
  getApiErrorDetails: vi.fn((err, fallback) => ({
    message: err?.message ?? fallback,
    fields: [],
    fieldMessages: {},
  })),
}));

vi.mock('../../../lib/files', () => ({
  uploadFileForRecord: vi.fn().mockResolvedValue('https://storage.example.com/file.pdf'),
}));

// Leaflet / MapContainer tidak bisa dirender di jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => null,
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
}));

// AppShell hanya wrapper layout — render children langsung
vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const defaultProps = {
  mode: 'create',
  onCancel: vi.fn(),
  onNavigate: vi.fn(),
  onSaved: vi.fn(),
};

const renderForm = (props = {}) =>
  render(<IspAdminFormPage {...defaultProps} {...props} />);

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('IspAdminFormPage — Tambah ISP Baru', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Render dasar
  it('menampilkan form pendaftaran ISP baru', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: /daftar.*mitra isp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tambah isp/i })).toBeInTheDocument();
  });

  // 2. Validasi: nama kosong
  it('menampilkan error jika nama ISP kosong saat submit', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /tambah isp/i }));
    await waitFor(() => {
      expect(screen.getByText(/nama isp wajib diisi/i)).toBeInTheDocument();
    });
  });

  // 3. Validasi: periode akhir lebih awal dari periode awal
  it('menampilkan error jika periode akhir lebih awal dari periode awal', async () => {
    renderForm();

    // Isi nama dulu agar tidak kena validasi nama
    const namaInput = screen.getByPlaceholderText(/pt\. internet cepat/i);
    await userEvent.type(namaInput, 'PT. Mitra Fiber Test');

    // Set periode awal = 2026-06-01, akhir = 2026-01-01 (terbalik)
    const dateInputs = document.querySelectorAll('input[type="date"]');
    // dateInputs[0] = Awal Kontrak, [1] = Periode Berjalan Awal, [2] = Periode Berjalan Akhir
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-01' } });
    fireEvent.change(dateInputs[2], { target: { value: '2026-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: /tambah isp/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/periode berjalan akhir tidak boleh lebih awal/i)
      ).toBeInTheDocument();
    });
  });

  // 4. Submit sukses dengan data valid
  it('memanggil api.isps.create dengan data yang benar saat form valid', async () => {
    const { default: api } = await import('../../../lib/api');
    api.isps.create.mockResolvedValue({ id: 'isp-123', name: 'PT. Fiber Nusantara' });

    renderForm();

    const namaInput = screen.getByPlaceholderText(/pt\. internet cepat/i);
    await userEvent.type(namaInput, 'PT. Fiber Nusantara');

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2098-01-15' } });
    fireEvent.change(dateInputs[1], { target: { value: '2099-02-01' } });
    fireEvent.change(dateInputs[2], { target: { value: '2100-01-31' } });

    fireEvent.click(screen.getByRole('button', { name: /tambah isp/i }));

    await waitFor(() => {
      expect(api.isps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PT. Fiber Nusantara',
          status: 'belum_beroperasi',
          contractStartDate: '2098-01-15',
          contractPeriodStart: '2099-02-01',
          contractPeriodEnd: '2100-01-31',
        })
      );
    });
    expect(defaultProps.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'isp-123' })
    );
  });

  it('mengirim status aktif jika periode berjalan awal hari ini atau sudah lewat', async () => {
    const { default: api } = await import('../../../lib/api');
    api.isps.create.mockResolvedValue({ id: 'isp-aktif', name: 'PT. Aktif Hari Ini' });

    renderForm();

    const namaInput = screen.getByPlaceholderText(/pt\. internet cepat/i);
    await userEvent.type(namaInput, 'PT. Aktif Hari Ini');

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayIso = `${year}-${month}-${day}`;

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: todayIso } });

    fireEvent.click(screen.getByRole('button', { name: /tambah isp/i }));

    await waitFor(() => {
      expect(api.isps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PT. Aktif Hari Ini',
          status: 'aktif',
          contractPeriodStart: todayIso,
        })
      );
    });
  });

  // 5. Tombol Batal memanggil onCancel
  it('memanggil onCancel saat tombol Batal diklik', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /batal/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  // 6. Tambah titik masuk FO
  it('menambahkan baris entry point saat tombol Tambah Titik diklik', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /tambah titik/i }));
    await waitFor(() => {
      // Komponen merender "Titik #1" di dua tempat (button peta + label baris)
      expect(screen.getAllByText(/titik #1/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // 7. Validasi entry point: label wajib jika ada nilai lain
  it('menampilkan error entry point jika koordinat diisi tapi label kosong', async () => {
    renderForm();

    // Tambah titik
    fireEvent.click(screen.getByRole('button', { name: /tambah titik/i }));

    // Isi latitude tapi biarkan label kosong
    const latInput = screen.getByPlaceholderText(/-5\.0929/i);
    await userEvent.type(latInput, '-5.092956');

    // Isi nama ISP agar tidak kena validasi nama
    const namaInput = screen.getByPlaceholderText(/pt\. internet cepat/i);
    await userEvent.type(namaInput, 'PT. Test ISP');

    fireEvent.click(screen.getByRole('button', { name: /tambah isp/i }));

    await waitFor(() => {
      expect(screen.getByText(/nama titik wajib diisi/i)).toBeInTheDocument();
    });
  });

  // 8. Mode edit: tombol submit bertuliskan "Simpan Perubahan"
  it('menampilkan teks "Simpan Perubahan" pada mode edit', () => {
    renderForm({
      mode: 'edit',
      initialData: { id: 'isp-1', name: 'PT. Lama', status: 'aktif' },
    });
    expect(screen.getByRole('button', { name: /simpan perubahan/i })).toBeInTheDocument();
  });
});
