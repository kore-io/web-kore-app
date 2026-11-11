import { Button, Checkbox, Radio, Select, useToast } from '@kore-io/design';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ExportControllerExportV1Format,
  ExportControllerExportV1Who,
} from '../../../shared/api/generated/model';
import { usePartiesControllerListV1 } from '../../../shared/api/generated/parties/parties';
import { useTagsControllerListV1 } from '../../../shared/api/generated/tags/tags';
import { FormField } from '../../../shared/components/form-field';
import { downloadExport } from '../export-download';
import { useActiveWedding } from '../hooks/use-active-wedding';

/** As colunas na ordem do Penpot e do arquivo (RN04). */
const COLUMNS = [
  'name',
  'party',
  'ageGroup',
  'dietaryRestriction',
  'rsvp',
  'phone',
  'tags',
] as const;
type Column = (typeof COLUMNS)[number];
/** Telefone de contato e Tags vêm desmarcadas (RN04 e RN05). */
const DEFAULT_COLUMNS: readonly Column[] = [
  'name',
  'party',
  'ageGroup',
  'dietaryRestriction',
  'rsvp',
];

/** Aba Exportar (Exportação de convidados, RN01 a RN06; decisão 212). */
export function ExportPage() {
  const { weddingId } = useActiveWedding();
  if (!weddingId) return null;
  return <ExportForm weddingId={weddingId} />;
}

function ExportForm({ weddingId }: { weddingId: string }) {
  const { t } = useTranslation('guests');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  // Os números de Todos e Confirmados vêm do resumo da lista (RN02): basta 1 grupo.
  const parties = usePartiesControllerListV1(weddingId, { limit: 1 });
  const tags = useTagsControllerListV1(weddingId);
  const summary = parties.data?.summary;
  const tagList = tags.data?.data ?? [];
  const firstTag = tagList.find((tag) => tag.guests > 0);

  const [format, setFormat] = useState<ExportControllerExportV1Format>('xlsx');
  // Começa em Confirmados quando há confirmado; senão, em Todos (212(2)).
  const [chosenWho, setWho] = useState<ExportControllerExportV1Who | null>(null);
  const who: ExportControllerExportV1Who =
    chosenWho ?? ((summary?.confirmed ?? 0) > 0 ? 'confirmed' : 'all');
  const [chosenTag, setTag] = useState<string | null>(null);
  const tagId = chosenTag ?? firstTag?.id ?? null;
  const [columns, setColumns] = useState<readonly Column[]>(DEFAULT_COLUMNS);

  const download = useMutation({
    mutationFn: downloadExport,
    onError: () =>
      showToast({
        tone: 'danger',
        message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
      }),
  });

  const count =
    who === 'all'
      ? (summary?.namedGuests ?? 0)
      : who === 'confirmed'
        ? (summary?.confirmed ?? 0)
        : (tagList.find((tag) => tag.id === tagId)?.guests ?? 0);
  const canExport =
    summary !== undefined &&
    columns.length > 0 &&
    count > 0 &&
    (who !== 'tag' || tagId !== null) &&
    !download.isPending;

  function toggle(column: Column, checked: boolean) {
    setColumns((current) =>
      COLUMNS.filter((item) => (item === column ? checked : current.includes(item))),
    );
  }

  return (
    <form
      className="kore-export"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canExport) return;
        download.mutate({
          weddingId,
          params: {
            format,
            who,
            columns: columns.join(','),
            ...(who === 'tag' && tagId !== null && { tag: tagId }),
          },
        });
      }}
    >
      <fieldset className="kore-export__group">
        <legend className="kore-export__legend">{t('exportList.format')}</legend>
        <div className="kore-export__options">
          {(['xlsx', 'pdf'] as const).map((value) => (
            <Radio
              key={value}
              name="format"
              value={value}
              checked={format === value}
              onChange={() => setFormat(value)}
            >
              {t(`exportList.${value}`)}
            </Radio>
          ))}
        </div>
      </fieldset>

      <fieldset className="kore-export__group">
        <legend className="kore-export__legend">{t('exportList.who')}</legend>
        <div className="kore-export__options">
          <Radio name="who" value="all" checked={who === 'all'} onChange={() => setWho('all')}>
            {t('exportList.all', { count: summary?.namedGuests ?? 0 })}
          </Radio>
          <Radio
            name="who"
            value="confirmed"
            checked={who === 'confirmed'}
            disabled={(summary?.confirmed ?? 0) === 0}
            onChange={() => setWho('confirmed')}
          >
            {t('exportList.confirmed', { count: summary?.confirmed ?? 0 })}
          </Radio>
          <Radio
            name="who"
            value="tag"
            checked={who === 'tag'}
            disabled={firstTag === undefined}
            onChange={() => setWho('tag')}
          >
            {t('exportList.tag')}
          </Radio>
        </div>
        {who === 'tag' && (
          <div className="kore-export__tag">
            <FormField label={t('exportList.tagLabel')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={tagId ?? ''}
                  onChange={(event) => setTag(event.target.value)}
                >
                  {tagList.map((tag) => (
                    <option key={tag.id} value={tag.id} disabled={tag.guests === 0}>
                      {t('exportList.tagOption', { name: tag.name, count: tag.guests })}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        )}
      </fieldset>

      <fieldset className="kore-export__group">
        <legend className="kore-export__legend">{t('exportList.columns')}</legend>
        <div className="kore-export__columns">
          {COLUMNS.map((column) => (
            <Checkbox
              key={column}
              checked={columns.includes(column)}
              onChange={(event) => toggle(column, event.target.checked)}
            >
              {t(`exportList.column.${column}`)}
            </Checkbox>
          ))}
        </div>
      </fieldset>

      {(summary?.confirmed ?? 0) > 0 && (
        <p className="kore-export__note">
          {t('exportList.buffet', { count: summary?.confirmed ?? 0 })}
        </p>
      )}

      <div className="kore-export__actions">
        <Button type="submit" disabled={!canExport}>
          {t('exportList.export', { count })}
        </Button>
      </div>
    </form>
  );
}
