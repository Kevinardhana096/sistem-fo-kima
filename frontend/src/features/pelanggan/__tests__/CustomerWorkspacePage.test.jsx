import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CustomerWorkspacePage from '../CustomerWorkspacePage';

vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../../components/shared/AppShared', () => ({
  SummaryCard: ({ label, value }) => <div>{label}: {value}</div>,
  StatCard: ({ label, value }) => <div>{label}: {value}</div>,
}));

vi.mock('../../../lib/api', () => ({
  default: {
    isps: {
      delete: vi.fn(),
    },
    customers: {
      delete: vi.fn(),
    },
  },
}));

const defaultProps = {
  activeSection: 'customers',
  customers: [],
  customersPageInfo: { count: 0, hasMore: false },
  notificationCountsByCustomerId: {},
  notificationCountsByIspId: {},
  isps: [],
  error: '',
  secondaryError: '',
  isLoading: false,
  currentRole: 'admin',
  onNavigate: vi.fn(),
  onLogout: vi.fn(),
  onOpenTenant: vi.fn(),
  onOpenIsp: vi.fn(),
  onOpenCreateTenant: vi.fn(),
  onOpenCreateIsp: vi.fn(),
  onRefresh: vi.fn(),
  onLoadMoreCustomers: vi.fn(),
};

const renderWorkspace = (props = {}) => render(
  <CustomerWorkspacePage {...defaultProps} {...props} />,
);

describe('CustomerWorkspacePage - aksi grup ISP', () => {
  it('tidak menampilkan aksi detail dan hapus ISP pada grup lokasi tanpa ISP terdaftar', () => {
    renderWorkspace({
      customers: [
        {
          id: 101,
          name: 'Lokasi Tanpa Master ISP',
          customerId: 'CUST-101',
          status: 'aktif',
          routeStatus: 'aktif',
          ispList: ['ISP Tidak Ada Di Master'],
          ispDisplay: 'ISP Tidak Ada Di Master',
        },
      ],
      isps: [],
    });

    expect(screen.getByText(/lokasi tanpa isp terdaftar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /detail isp/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/hapus isp/i)).not.toBeInTheDocument();
  });

  it('tetap membuka detail untuk grup ISP master yang memiliki ID valid', async () => {
    const onOpenIsp = vi.fn();
    const isp = {
      id: 7,
      name: 'PT ISP Valid',
      status: 'aktif',
      contractReference: 'KTR-ISP-007',
    };

    renderWorkspace({
      isps: [isp],
      onOpenIsp,
    });

    await userEvent.click(screen.getByRole('button', { name: /detail isp/i }));

    expect(onOpenIsp).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      name: 'PT ISP Valid',
    }));
  });

  it('menampilkan jumlah tindakan grup ISP dari tindakan ISP saja', () => {
    renderWorkspace({
      isps: [
        {
          id: 26,
          name: 'PT Indonesia Comnet Plus',
          status: 'aktif',
          contractReference: 'KTR-ISP-026',
        },
      ],
      customers: [
        {
          id: 101,
          name: 'Lokasi Dengan Tindakan',
          customerId: 'CUST-101',
          status: 'aktif',
          routeStatus: 'aktif',
          ispList: ['PT Indonesia Comnet Plus'],
          ispDisplay: 'PT Indonesia Comnet Plus',
          actionSummary: {
            priority: 2,
            needAction: 2,
            total: 4,
          },
        },
      ],
      notificationCountsByIspId: {
        26: {
          active: 1,
          unread: 1,
        },
      },
    });

    expect(screen.getByText('1 TINDAKAN')).toBeInTheDocument();
    expect(screen.queryByText('5 TINDAKAN')).not.toBeInTheDocument();
  });

  it('menyembunyikan grup ISP yang tidak berisi lokasi sesuai pencarian lokasi', async () => {
    renderWorkspace({
      isps: [
        { id: 1, name: 'ISP Lokasi Cocok', status: 'aktif' },
        { id: 2, name: 'ISP Lokasi Lain', status: 'aktif' },
      ],
      customers: [
        {
          id: 201,
          name: 'Gudang Kima 5',
          customerId: 'CUST-201',
          status: 'aktif',
          routeStatus: 'aktif',
          ispList: ['ISP Lokasi Cocok'],
          ispDisplay: 'ISP Lokasi Cocok',
        },
        {
          id: 202,
          name: 'Gudang Maros',
          customerId: 'CUST-202',
          status: 'aktif',
          routeStatus: 'aktif',
          ispList: ['ISP Lokasi Lain'],
          ispDisplay: 'ISP Lokasi Lain',
        },
      ],
    });

    await userEvent.type(screen.getByPlaceholderText(/cari id, isp, atau nama lokasi/i), 'kima 5');

    expect(screen.getByText('ISP Lokasi Cocok')).toBeInTheDocument();
    expect(screen.getByText('Gudang Kima 5')).toBeInTheDocument();
    expect(screen.queryByText('ISP Lokasi Lain')).not.toBeInTheDocument();
    expect(screen.queryByText('Gudang Maros')).not.toBeInTheDocument();
  });

  it('saat pencarian ISP hanya menampilkan grup ISP yang namanya cocok', async () => {
    renderWorkspace({
      isps: [
        { id: 1, name: 'PT Telkom Indonesia', status: 'aktif' },
        { id: 2, name: 'PT Moratelindo', status: 'aktif' },
      ],
      customers: [
        {
          id: 301,
          name: 'Lokasi Multi ISP',
          customerId: 'CUST-301',
          status: 'aktif',
          routeStatus: 'aktif',
          ispList: ['PT Telkom Indonesia', 'PT Moratelindo'],
          ispDisplay: 'PT Telkom Indonesia, PT Moratelindo',
        },
      ],
    });

    await userEvent.type(screen.getByPlaceholderText(/cari id, isp, atau nama lokasi/i), 'telkom');

    expect(screen.getByText('PT Telkom Indonesia')).toBeInTheDocument();
    expect(screen.getByText('Lokasi Multi ISP')).toBeInTheDocument();
    expect(screen.queryByText('PT Moratelindo')).not.toBeInTheDocument();
  });
});
