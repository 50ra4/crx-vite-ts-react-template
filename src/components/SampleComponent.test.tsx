import { render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { SampleComponent } from './SampleComponent';

describe('SampleComponent.tex', () => {
  test('render App component', () => {
    render(<SampleComponent />);
    expect(screen.getByText('Sample Component')).toBeInTheDocument();
  });
});
