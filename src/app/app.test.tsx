import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('monta sem erro', () => {
    const { container } = render(<App />);
    expect(container).toBeEmptyDOMElement();
  });
});
