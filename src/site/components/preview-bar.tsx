import { Input, SegmentedControl, Select } from '@kore-io/design';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSiteResponse } from '../../shared/api/generated/model';
import {
  publicSiteControllerChangePreviewV1,
  publicSiteControllerPreviewPartiesV1,
} from '../../shared/api/generated/sites/sites';

const MAX_LISTED = 100;

/**
 * A barra da prévia (Pré-visualização RN06; Penpot "Barra da prévia"): fixa no topo, nas
 * cores do Kore. O texto da prévia, o "Ver como" (Visitante · Grupo) e, como grupo, o
 * Select dos grupos (até 100; com mais, a busca e a linha de apoio). Trocar chama o
 * `PATCH …/preview-session` e recarrega o site.
 */
export function PreviewBar({ site }: { site: PublicSiteResponse }) {
  const { t } = useTranslation('publicSite');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // O id do grupo escolhido (o GET só traz o nome); antes da 1ª troca, o do nome igual.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const searchId = useId();
  const mode = site.viewer.preview?.as ?? 'visitor';
  const partyName = site.viewer.party?.name;
  const parties = useQuery({
    queryKey: ['preview-parties', site.slug, search],
    queryFn: () =>
      publicSiteControllerPreviewPartiesV1(
        site.slug,
        search.trim() ? { q: search.trim() } : undefined,
      ),
    staleTime: 30_000,
  });
  const list = parties.data?.data ?? [];
  const total = parties.data?.total ?? 0;
  const current =
    list.find((party) => party.id === chosenId) ??
    (chosenId ? undefined : list.find((party) => party.name === partyName));
  const published = site.viewer.preview?.published === true;
  // A voz da linha de apoio pelo papel de quem gerou a prévia (dono → casal; colaborador →
  // singular), que vem do servidor.
  const audience = site.viewer.preview?.audience ?? 'couple';
  const text =
    mode === 'party' && partyName
      ? t(published ? 'preview.publishedParty' : 'preview.draftParty', { name: partyName })
      : t(published ? 'preview.published' : 'preview.draft');

  async function change(body: { mode: 'visitor' | 'party'; partyId?: string }) {
    const result = await publicSiteControllerChangePreviewV1(site.slug, body);
    setChosenId(result.party?.id ?? null);
    await queryClient.invalidateQueries({ queryKey: ['public-site', site.slug] });
  }

  return (
    <div className="kore-site-preview" role="region" aria-label={t('preview.viewAs')}>
      <p className="kore-site-preview__text">{text}</p>
      <div className="kore-site-preview__controls">
        <SegmentedControl
          label={t('preview.viewAs')}
          options={[
            { value: 'visitor', label: t('preview.visitor') },
            { value: 'party', label: t('preview.party') },
          ]}
          value={mode}
          disabled={mode === 'visitor' && list.length === 0}
          onChange={(next) => {
            const first = current ?? list[0];
            if (next === 'party' && first) void change({ mode: 'party', partyId: first.id });
            if (next === 'visitor') void change({ mode: 'visitor' });
          }}
        />
        {mode === 'party' && (
          <div className="kore-site-preview__party">
            {(total > MAX_LISTED || search) && (
              <Input
                id={searchId}
                type="search"
                className="kore-site-preview__search"
                placeholder={t('preview.search')}
                aria-label={t('preview.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            <Select
              aria-label={t('preview.party')}
              className="kore-site-preview__select"
              value={current?.id ?? ''}
              onChange={(event) => void change({ mode: 'party', partyId: event.target.value })}
            >
              {!current && partyName && <option value="">{partyName}</option>}
              {list.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {mode === 'party' && total > MAX_LISTED && (
        <p className="kore-site-preview__more">{t(`preview.more.${audience}`, { total })}</p>
      )}
    </div>
  );
}
