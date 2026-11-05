import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../tests/a11y';
import { formatLongDate } from '../profile-texts';
import { CoupleInviteStep, type CoupleInviteStepProps } from './couple-invite-step';

function props(overrides: Partial<CoupleInviteStepProps> = {}): CoupleInviteStepProps {
  return {
    organization: 'Prado Assessoria',
    plannerName: 'Juliana',
    preview: {
      couple: 'Ana & Marcos',
      details: `${formatLongDate({ isoDate: '2026-11-14' })} · Campinas`,
    },
    onAccept: vi.fn(),
    onViewSite: vi.fn(),
    ...overrides,
  };
}

describe('Convite do casal (decisões 102, 106 e 156)', () => {
  it('com e-\u2060mail: textos, prévia, desconto, as duas ações e a nota', async () => {
    const user = userEvent.setup();
    const stepProps = props({ discountPercent: 10, invitedEmail: 'ana.moreira@gmail.com' });
    render(<CoupleInviteStep {...stepProps} />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Prado Assessoria preparou este site para vocês.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Confiram tudo antes de aceitar. Ao aceitar, vocês viram os donos do casamento, e Juliana continua ajudando na organização.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('14 de novembro de 2026 · Campinas')).toBeInTheDocument();
    expect(
      screen.getByText('Vocês ganham 10% de desconto na ativação do site.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Vocês entram com o Google ou com um código no e-\u2060mail ana.moreira@gmail.com.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aceitar e virar dono' }));
    expect(stepProps.onAccept).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Ver o site completo' }));
    expect(stepProps.onViewSite).toHaveBeenCalledTimes(1);
  });

  it('por link: sem a nota do e-\u2060mail; sem indicação, sem o destaque', () => {
    render(<CoupleInviteStep {...props()} />);
    expect(screen.queryByText(/Vocês entram com o Google/)).toBeNull();
    expect(screen.queryByText(/de desconto/)).toBeNull();
  });

  it('a prévia usa o tema do site do casal e a pílula é só ilustração', () => {
    const { container } = render(
      <CoupleInviteStep
        {...props({
          preview: {
            couple: 'Ana & Marcos',
            details: 'x',
            theme: { colors: 'salvia', fonts: 'leve' },
          },
        })}
      />,
    );
    const preview = container.querySelector('.kore-site-preview');
    expect(preview).toHaveAttribute('data-site-colors', 'salvia');
    expect(preview).toHaveAttribute('data-site-fonts', 'leve');
    expect(screen.queryByRole('button', { name: 'Confirmar presença' })).toBeNull();
  });

  it('é acessível', async () => {
    const { container } = render(
      <main>
        <CoupleInviteStep {...props({ discountPercent: 10, invitedEmail: 'a@exemplo.com' })} />
      </main>,
    );
    await expectNoA11yViolations({ container });
  });
});
