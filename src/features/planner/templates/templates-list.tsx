import { Button, siteFonts } from '@kore-io/design';
import { useTranslation } from 'react-i18next';
import type { PlannerTemplateResponse } from '../../../shared/api/generated/model';
import {
  BACKGROUNDS,
  STARTER_PALETTES,
  type BackgroundMode,
  type FontPairKey,
  type PaletteKey,
} from '../../site/appearance';
import { appearanceOf, textOf, type TemplateTab } from './templates-model';

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const FULL = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** "12/06", a data em que o modelo foi criado, com o ano só fora do ano corrente (Voz). */
export function createdText({ at, now = new Date() }: { at: string; now?: Date }): string {
  const date = new Date(at);
  return (date.getFullYear() === now.getFullYear() ? DAY_MONTH : FULL).format(date);
}

/**
 * A lista de Modelos (RN06; Penpot 11): Nome · Seção · Criado em (Aparência: Nome · Amostra ·
 * Criado em) com Editar e Excluir, em tabela no desktop e em cartões no tablet e no celular
 * (nos Textos, com a prévia de 2 linhas). A ordem é a do servidor, do mais novo.
 */
export function TemplatesList({
  tab,
  templates,
  onEdit,
  onDelete,
}: {
  tab: TemplateTab;
  templates: readonly PlannerTemplateResponse[];
  onEdit: (template: PlannerTemplateResponse) => void;
  onDelete: (template: PlannerTemplateResponse) => void;
}) {
  const { t } = useTranslation('planner');
  const created = (template: PlannerTemplateResponse) => createdText({ at: template.createdAt });
  // O FAQ é uma seção só: a coluna Seção diz "FAQ" (Penpot 11).
  const section = (template: PlannerTemplateResponse) =>
    template.sectionType
      ? t(`templates.sections.${template.sectionType}`)
      : t('templates.tabs.faq');
  const actions = (template: PlannerTemplateResponse) => (
    <span className="kore-templates__actions">
      <Button
        type="button"
        variant="ghost"
        aria-label={t('templates.editName', { name: template.name })}
        onClick={() => onEdit(template)}
      >
        {t('templates.edit')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label={t('templates.deleteName', { name: template.name })}
        onClick={() => onDelete(template)}
      >
        {t('templates.delete')}
      </Button>
    </span>
  );

  return (
    <>
      <table className="kore-templates__table">
        <thead>
          <tr>
            <th scope="col">{t('templates.columns.name')}</th>
            <th scope="col">
              {t(`templates.columns.${tab === 'appearance' ? 'sample' : 'section'}`)}
            </th>
            <th scope="col">{t('templates.columns.createdAt')}</th>
            <td aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <th scope="row">{template.name}</th>
              <td>
                {tab === 'appearance' ? (
                  <AppearanceSample template={template} />
                ) : (
                  section(template)
                )}
              </td>
              <td>{created(template)}</td>
              <td className="kore-templates__actions-cell">{actions(template)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="kore-templates__cards">
        {templates.map((template) => (
          <li key={template.id} className="kore-templates__card">
            <span className="kore-templates__card-name">{template.name}</span>
            {tab === 'appearance' ? (
              <>
                <AppearanceSample template={template} />
                <span className="kore-templates__card-meta">
                  {t('templates.createdOn', { date: created(template) })}
                </span>
              </>
            ) : (
              <span className="kore-templates__card-meta">
                {section(template)} · {t('templates.createdOn', { date: created(template) })}
              </span>
            )}
            {tab === 'texts' && (
              <span className="kore-templates__card-preview">{textOf(template)}</span>
            )}
            {actions(template)}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * A amostra da Aparência (Penpot 11): "Aa" na fonte do par, sobre o fundo, e as bolinhas da
 * cor principal e do destaque; para o leitor de tela, o texto da Voz ("Fontes Romântico ·
 * Cor principal Sálvia · Destaque … · Fundo creme").
 */
function AppearanceSample({ template }: { template: PlannerTemplateResponse }) {
  const { t } = useTranslation('planner');
  const { t: tSite } = useTranslation('site');
  const content = appearanceOf(template);
  const fonts = content.fontPairKey as FontPairKey;
  const backgroundMode = content.backgroundMode as BackgroundMode;
  const palette = content.starterPaletteKey as PaletteKey | null;
  const background = BACKGROUNDS[backgroundMode] as
    { background: string; foreground: string } | undefined;
  const pair = (siteFonts as Record<string, { display: string } | undefined>)[fonts];
  // Sem nome de cor no catálogo: a paleta de partida, ou "cor personalizada" (decisão 295).
  const shared = {
    fonts: tSite(`appearance.fonts.${fonts}`),
    background: tSite(`appearance.backgrounds.${backgroundMode}`).toLowerCase(),
  };
  const label =
    palette && palette in STARTER_PALETTES
      ? t('templates.sample.palette', {
          ...shared,
          palette: tSite(`appearance.palettes.${palette}`),
        })
      : t('templates.sample.custom', shared);
  return (
    <span className="kore-templates__sample" role="img" aria-label={label}>
      <span
        className="kore-templates__sample-fonts"
        style={{
          ...(pair && { fontFamily: `'${pair.display}', serif` }),
          ...(background && {
            backgroundColor: background.background,
            color: background.foreground,
          }),
        }}
        aria-hidden="true"
      >
        Aa
      </span>
      {[content.primaryColor, content.accentColor].map((color, index) => (
        <span
          key={index}
          className="kore-templates__swatch"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
