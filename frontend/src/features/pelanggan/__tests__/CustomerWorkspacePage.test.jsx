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
});
