import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TenantAdminFormPage from '../TenantAdminFormPage';

vi.mock('../../../lib/api', () => ({
  default: { customers: { create: vi.fn(), update: vi.fn() } },
  getApiErrorDetails: vi.fn((err, fallback) => ({ message: err?.message ?? fallback, fields: [], fieldMessages: {} })),
}));

vi.mock('../../../lib/files', () => ({
  uploadFileForRecord: vi.fn().mockResolvedValue('https://storage.example.com/logo.png'),
}));

vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const MOCK_ISPS = [
  { id: 1, name: 'PT. Nusantara Fiber Optik', contractReference: 'KTR/ISP/007/2026' },
  { id: 2, name: 'PT. Cepat Internet', contractReference: 'KTR/ISP/008/2026' },
];

const defaultProps = {
  mode: 'create', isps: MOCK_ISPS, lockedIsp: null,
  onCancel: vi.fn(), onNavigate: vi.fn(), onSaved: vi.fn(),
};

const submitForm = () => fireEvent.submit(document.querySelector('form'));

// ── Upload Logo ────────────────────────────────────────────────────────────

describe('TenantAdminFormPage — Upload Logo Lokasi', () => {
  let mockUpload;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUpload = (await import('../../../lib/files')).uploadFileForRecord;
    mockUpload.mockResolvedValue('https://storage.example.com/logo.png');
  });

  it('memanggil uploadFileForRecord saat logo dipilih', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.upload(
      document.querySelector('input[type="file"]'),
      new File(['img'], 'logo.png', { type: 'image/png' })
    );
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(expect.any(File), expect.arrayContaining(['customers']));
    });
  });

  it('menampilkan preview logo setelah upload berhasil', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.upload(
      document.querySelector('input[type="file"]'),
      new File(['img'], 'logo.png', { type: 'image/png' })
    );
    await waitFor(() => {
      expect(document.querySelector('img[alt="Preview"]')).toBeInTheDocument();
    });
  });

  it('menghapus logo saat tombol Hapus Logo diklik', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.upload(
      document.querySelector('input[type="file"]'),
      new File(['img'], 'logo.png', { type: 'image/png' })
    );
    await waitFor(() => screen.getByRole('button', { name: /hapus logo/i }));
    await userEvent.click(screen.getByRole('button', { name: /hapus logo/i }));
    await waitFor(() => {
      expect(document.querySelector('img[alt="Preview"]')).not.toBeInTheDocument();
    });
  });
});

// ── Form Lokasi ────────────────────────────────────────────────────────────

describe('TenantAdminFormPage — Tambah Lokasi Baru', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menampilkan form pendaftaran lokasi baru', () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /daftar.*lokasi baru/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tambah lokasi/i })).toBeInTheDocument();
  });

  it('menampilkan daftar ISP yang tersedia untuk dipilih', () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    expect(screen.getByText('PT. Nusantara Fiber Optik')).toBeInTheDocument();
    expect(screen.getByText('PT. Cepat Internet')).toBeInTheDocument();
  });

  it('menampilkan error jika nama lokasi kosong saat submit', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    submitForm();
    await waitFor(() => expect(screen.getByText(/nama lokasi wajib diisi/i)).toBeInTheDocument());
  });

  it('menampilkan error jika ISP belum dipilih saat submit', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/gedung a/i), 'Gedung Test');
    submitForm();
    await waitFor(() => expect(screen.getByText(/lokasi harus terhubung ke satu isp/i)).toBeInTheDocument());
  });

  it('menampilkan error jika jumlah core kurang dari 1', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/gedung a/i), 'Gedung Test');
    fireEvent.click(screen.getByText('PT. Nusantara Fiber Optik'));
    const coreInput = screen.getByPlaceholderText('1');
    await userEvent.clear(coreInput);
    await userEvent.type(coreInput, '0');
    submitForm();
    await waitFor(() => expect(screen.getByText(/jumlah core minimal 1/i)).toBeInTheDocument());
  });

  it('menampilkan error jika periode kontrak tidak diisi saat submit', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/gedung a/i), 'Gedung Test');
    fireEvent.click(screen.getByText('PT. Nusantara Fiber Optik'));
    const coreInput = screen.getByPlaceholderText('1');
    await userEvent.clear(coreInput);
    await userEvent.type(coreInput, '4');
    submitForm();
    await waitFor(() => expect(screen.getByText(/periode kontrak tidak valid/i)).toBeInTheDocument());
  });

  it('memanggil api.customers.create dengan data yang benar saat form valid', async () => {
    const { default: api } = await import('../../../lib/api');
    api.customers.create.mockResolvedValue({ id: 'cust-1', name: 'Gedung Sukses' });
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/gedung a/i), 'Gedung Sukses');
    fireEvent.click(screen.getByText('PT. Nusantara Fiber Optik'));
    const coreInput = screen.getByPlaceholderText('1');
    await userEvent.clear(coreInput);
    await userEvent.type(coreInput, '4');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(dateInputs[1], '2026-02-01');
    fireEvent.change(dateInputs[1], { target: { value: '2026-02-01' } });
    nativeSetter.call(dateInputs[2], '2027-01-31');
    fireEvent.change(dateInputs[2], { target: { value: '2027-01-31' } });
    submitForm();
    await waitFor(() => {
      expect(api.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gedung Sukses',
          ispIds: [1],
          contractStartDate: '2026-02-01',
          contractPeriodStart: '2026-02-01',
          contractPeriodEnd: '2027-01-31',
        })
      );
    }, { timeout: 3000 });
    expect(defaultProps.onSaved).toHaveBeenCalled();
  });

  it('memanggil onCancel saat tombol Batal diklik', () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /batal/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('memilih ISP secara otomatis jika lockedIsp diberikan', () => {
    render(<TenantAdminFormPage {...defaultProps} lockedIsp={MOCK_ISPS[0]} />);
    expect(screen.getByText('PT. Nusantara Fiber Optik')).toBeInTheDocument();
  });

  it('menampilkan teks "Simpan Perubahan" pada mode edit', () => {
    render(<TenantAdminFormPage {...defaultProps} mode="edit" initialData={{ id: 'c1', name: 'Gedung Lama', status: 'aktif' }} />);
    expect(screen.getByRole('button', { name: /simpan perubahan/i })).toBeInTheDocument();
  });

  it('menampilkan input ratio saat paket Sharing Core dipilih', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    const paketSelect = screen.getByText('CORE').closest('[class*="cursor-pointer"]');
    fireEvent.click(paketSelect);
    await waitFor(() => screen.getByText('SHARING CORE'));
    fireEvent.click(screen.getByText('SHARING CORE'));
    await waitFor(() => expect(screen.getByText(/ratio shared/i)).toBeInTheDocument());
  });

  it('memfilter daftar ISP berdasarkan kata kunci pencarian', async () => {
    render(<TenantAdminFormPage {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/cari isp/i), 'Nusantara');
    await waitFor(() => {
      expect(screen.getByText('PT. Nusantara Fiber Optik')).toBeInTheDocument();
      expect(screen.queryByText('PT. Cepat Internet')).not.toBeInTheDocument();
    });
  });
});
