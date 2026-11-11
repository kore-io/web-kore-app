import { Alert, Button, FileUpload, Spinner, StatCard } from '@kore-io/design';
import { FileSpreadsheet, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SpreadsheetPreviewResponse } from '../../../shared/api/generated/model';
import { useActiveWedding, type Audience } from '../hooks/use-active-wedding';
import { usePasteImport } from '../hooks/use-paste-import';
import { useSpreadsheetImport } from '../hooks/use-spreadsheet-import';
import { rowErrorText } from '../import-texts';
import { PastePreview, PasteText } from './paste-list';

/** O modelo estático da planilha (decisão 209), em public/. */
const TEMPLATE_URL = '/modelo-convidados-kore.xlsx';

/** Aba Importar (Importação de convidados, RN01 a RN12), dentro do GuestsLayout. */
export function ImportPage() {
  const { weddingId, audience } = useActiveWedding();
  if (!weddingId) return null;
  return <ImportView weddingId={weddingId} audience={audience} />;
}

function ImportView({ weddingId, audience }: { weddingId: string; audience: Audience }) {
  const sheet = useSpreadsheetImport({ weddingId, audience });
  const paste = usePasteImport({ weddingId, audience });
  // O Colar a lista abre no lugar do envio; o Voltar dele volta, guardando o texto (210(7)).
  const [pasting, setPasting] = useState(false);
  if (pasting) {
    return paste.draft ? (
      <PastePreview paste={paste} audience={audience} />
    ) : (
      <PasteText paste={paste} audience={audience} onBack={() => setPasting(false)} />
    );
  }
  if (sheet.preview && sheet.file) {
    return (
      <Preview
        fileName={sheet.file.name}
        preview={sheet.preview}
        audience={audience}
        isImporting={sheet.isImporting}
        onReset={sheet.reset}
        onImport={sheet.importAll}
      />
    );
  }
  return <Upload audience={audience} sheet={sheet} onPaste={() => setPasting(true)} />;
}

/** Envio (RN02 e RN03): 1. Baixar o modelo; 2. Enviar a planilha preenchida. */
function Upload({
  audience,
  sheet,
  onPaste,
}: {
  audience: Audience;
  sheet: ReturnType<typeof useSpreadsheetImport>;
  onPaste: () => void;
}) {
  const { t } = useTranslation('guests');
  return (
    <section className="kore-import">
      <h2 className="kore-import__step">{t('importSheet.step1')}</h2>
      <p className="kore-import__text">{t('importSheet.step1Text')}</p>
      <a className="kore-import__download" href={TEMPLATE_URL} download>
        {t('importSheet.download')}
      </a>
      <h2 className="kore-import__step">{t('importSheet.step2')}</h2>
      <FileUpload
        title={t(`importSheet.drop.${audience}`)}
        hint={t('importSheet.dropHint')}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={sheet.isReading}
        onFile={sheet.send}
      />
      {sheet.isReading && (
        <div className="kore-import__reading">
          <Spinner label={t('importSheet.reading')} />
        </div>
      )}
      {sheet.refusal && (
        <Alert tone="danger" role="alert">
          {sheet.refusal}
        </Alert>
      )}
      <p className="kore-import__note">{t('importSheet.previewNote')}</p>
      <Button variant="secondary" onClick={onPaste}>
        {t('pasteList.open')}
      </Button>
    </section>
  );
}

/** Prévia (RN05 a RN09): o arquivo, os quadros, as linhas de fora, os avisos e o Importar. */
function Preview({
  fileName,
  preview,
  audience,
  isImporting,
  onReset,
  onImport,
}: {
  fileName: string;
  preview: SpreadsheetPreviewResponse;
  audience: Audience;
  isImporting: boolean;
  onReset: () => void;
  onImport: () => void;
}) {
  const { t } = useTranslation('guests');
  const parties = t('importSheet.parties', { count: preview.parties });
  const guests = t('importSheet.guests', { count: preview.guests });
  const leftOut = preview.counts.errors + preview.counts.duplicates;

  return (
    <div className="kore-import-preview">
      <section className="kore-import-preview__file">
        <span className="kore-import-preview__file-icon" aria-hidden="true">
          <FileSpreadsheet />
        </span>
        <span className="kore-import-preview__file-text">
          <span className="kore-import-preview__file-name">{preview.fileName || fileName}</span>
          <span className="kore-import-preview__file-counts">
            {t('importSheet.fileCounts', { parties, guests })}
          </span>
        </span>
        <button
          type="button"
          className="kore-import-preview__remove"
          aria-label={t('importSheet.removeFile')}
          onClick={onReset}
        >
          <X aria-hidden="true" />
        </button>
      </section>

      <div className="kore-import-preview__stats">
        <StatCard
          label={t('importSheet.valid')}
          value={preview.counts.valid}
          detail={t('importSheet.validDetail', { count: preview.parties })}
        />
        <StatCard
          label={t('importSheet.errors')}
          value={preview.counts.errors}
          detail={t('importSheet.leftOut')}
        />
        <StatCard
          label={t('importSheet.duplicates')}
          value={preview.counts.duplicates}
          detail={t('importSheet.leftOut')}
        />
      </div>

      {preview.skipped.length > 0 && (
        <section className="kore-import-preview__skipped">
          <h2 className="kore-import-preview__skipped-title">{t('importSheet.skippedTitle')}</h2>
          <ul className="kore-import-preview__rows">
            {preview.skipped.map((row, index) => (
              <li key={`${row.row}-${row.code}-${index}`} className="kore-import-preview__row">
                <span className="kore-import-preview__row-title">
                  {t('importSheet.row', {
                    row: row.row,
                    name: row.name ?? t('importSheet.noName'),
                  })}
                </span>
                <span className="kore-import-preview__row-error">
                  {rowErrorText({ t, row, audience })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <Alert tone="warning">
          <ul className="kore-import-preview__warnings">
            {preview.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.party ?? warning.tag ?? ''}`}>
                {warning.code === 'PARTY_NAME_EXISTS'
                  ? t('importSheet.partyExists', { party: warning.party ?? '' })
                  : t(`importSheet.tagLimit.${audience}`, { tag: warning.tag ?? '' })}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Alert tone="info" title={t('importSheet.summary', { parties, guests })}>
        {leftOut > 0 ? t(`importSheet.summaryLeftOut.${audience}`, { count: leftOut }) : null}
      </Alert>

      <div className="kore-import-preview__actions">
        <Button variant="secondary" onClick={onReset}>
          {t('importSheet.sendAnother')}
        </Button>
        <Button disabled={preview.guests === 0 || isImporting} onClick={onImport}>
          {t('importSheet.import', { count: preview.guests })}
        </Button>
      </div>
    </div>
  );
}
