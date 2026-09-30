import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BrandLink } from './BrandLink';

it('links the platform brand to the current community without a selector', () => {
  render(
    <MemoryRouter initialEntries={['/t/alpha/feed']}>
      <Routes>
        <Route path="/t/:tenantSlug/*" element={<BrandLink />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'UpdSpace' })).toHaveAttribute(
    'href',
    '/t/alpha',
  );
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
