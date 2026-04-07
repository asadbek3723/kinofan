import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

describe('Home', () => {
  it('renders hero title and create room button', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /kinofan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /xona yaratish/i })).toBeInTheDocument();
  });

  it('renders how it works section', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText(/qanday ishlaydi/i)).toBeInTheDocument();
  });
});
