import { useToast } from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { guestPartyEditPath, guestPartyPath } from '../../../app/paths';
import { getPartiesControllerGetV1QueryOptions } from '../../../shared/api/generated/parties/parties';
import type { PartyListItemResponse } from '../../../shared/api/generated/model';
import type { RowAction } from '../components/party-row-menu';

/**
 * As ações do ⋮ da lista. Copiar link e Mover para a lixeira precisam do grupo inteiro
 * (o link e os convidados com nome, que a linha não traz): o app busca o grupo na hora,
 * pelo mesmo GET do Painel, e reaproveita o cache dele.
 */
export function useRowActions({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trigger = useRef<HTMLElement | null>(null);
  const [trashing, setTrashing] = useState<{ id: string; name: string; named: number } | null>(
    null,
  );

  function failed() {
    showToast({
      tone: 'danger',
      message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
    });
  }

  function party(partyId: string) {
    return queryClient.fetchQuery(getPartiesControllerGetV1QueryOptions(weddingId, partyId));
  }

  return {
    trigger,
    trashing,
    closeTrash: () => setTrashing(null),
    onAction: ({
      action,
      party: row,
      trigger: button,
    }: {
      action: RowAction;
      party: PartyListItemResponse;
      trigger: HTMLElement | null;
    }) => {
      trigger.current = button;
      if (action === 'open') void navigate(guestPartyPath({ partyId: row.id }));
      if (action === 'edit') void navigate(guestPartyEditPath({ partyId: row.id }));
      if (action === 'copy') {
        const url = party(row.id).then((detail) => {
          if (!detail.link.url) throw new Error('sem link');
          return detail.link.url;
        });
        // O navegador só deixa escrever logo depois do clique: o write começa já, com o
        // texto ainda por vir (ClipboardItem com promessa). Sem ClipboardItem, espera o link.
        const write =
          typeof ClipboardItem === 'undefined'
            ? url.then((text) => navigator.clipboard.writeText(text))
            : navigator.clipboard.write([
                new ClipboardItem({
                  'text/plain': url.then((text) => new Blob([text], { type: 'text/plain' })),
                }),
              ]);
        void write
          .then(() => showToast({ tone: 'success', message: t('panel.link.copied') }))
          .catch(failed);
      }
      if (action === 'trash') {
        void party(row.id)
          .then((detail) =>
            setTrashing({
              id: row.id,
              name: row.name,
              named: detail.guests.filter((guest) => guest.name !== null).length,
            }),
          )
          .catch(failed);
      }
    },
  };
}
