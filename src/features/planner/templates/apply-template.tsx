import { Button, Dialog, Select, Spinner, useToast } from '@kore-io/design';
import { useState } from 'react';
import { FormField } from '../../../shared/components/form-field';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useTranslation } from 'react-i18next';
import { paths } from '../../../app/paths';
import { useActiveWedding } from '../../guests/hooks/use-active-wedding';
import { useMeControllerMeV1 } from '../../../shared/api/generated/me/me';
import type {
  PlannerTemplateResponse,
  SiteEditorResponse,
} from '../../../shared/api/generated/model';
import { draftFrom, type AppearanceDraft } from '../../site/components/appearance-fields';
import type { SectionTemplateActions } from '../../site/sections/template-actions';
import { usePlannerTemplatesControllerListV1 } from '../../../shared/api/generated/planner/planner';
import { applyMarkers } from './markers';
import { AppearanceSample } from './templates-list';
import {
  appearanceOf,
  questionsOf,
  textOf,
  type FaqQuestion,
  type TextSection,
} from './templates-model';

type Kind = PlannerTemplateResponse['kind'];

/** A aba de Modelos de cada tipo, para o Criar modelo do vazio (numa aba nova). */
const TAB_QUERY: Record<Kind, string> = {
  section_content: '',
  faq: '?aba=faq',
  appearance: '?aba=aparencia',
};

/**
 * Quem vê o Aplicar modelo (Modelos RN08): quem colabora neste casamento e tem o perfil de
 * cerimonialista (`planner` no /me). Segue o papel no casamento aberto, não o perfil ativo:
 * o casal não vê, nem o vendedor, nem a cerimonialista no próprio casamento de dona.
 */
export function useCanApplyTemplates(): boolean {
  const { role } = useActiveWedding();
  const { data: me } = useMeControllerMeV1();
  return role === 'collaborator' && Boolean(me?.planner);
}

export interface ApplyResult {
  /** O texto ficou com {data}, porque o casamento não tem data (RN07). */
  missingDate?: boolean;
}

/**
 * O Aplicar modelo de uma seção (Modelos RN08; Voz, Modelos do cerimonialista): o botão, o
 * seletor com os modelos do tipo (nos Textos, só os da seção aberta), o vazio com o Criar
 * modelo e a confirmação, sempre. Aplicar só preenche o editor: nada vai ao ar até Salvar.
 */
export function ApplyTemplate({
  kind,
  sectionType,
  sectionLabel,
  onApply,
}: {
  kind: Kind;
  sectionType?: TextSection;
  /** O nome da seção na confirmação dos Textos ("Nossa história"). */
  sectionLabel?: string;
  onApply: (template: PlannerTemplateResponse) => ApplyResult;
}) {
  const { t } = useTranslation('planner');
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PlannerTemplateResponse | null>(null);
  const list = usePlannerTemplatesControllerListV1(
    { kind, ...(sectionType && { sectionType }) },
    // Relê ao voltar à aba: o Criar modelo do vazio abre Modelos numa aba nova.
    { query: { enabled: open, refetchOnWindowFocus: true } },
  );

  function apply() {
    if (!chosen) return;
    const result = onApply(chosen);
    setChosen(null);
    showToast({
      tone: 'success',
      message: t(result.missingDate ? 'templates.apply.appliedNoDate' : 'templates.apply.applied'),
    });
  }

  return (
    <div className="kore-apply-template">
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {t('templates.apply.open')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        role="dialog"
        title={t('templates.apply.title')}
        actions={
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t('templates.apply.cancel')}
          </Button>
        }
      >
        {list.isError ? (
          <LoadErrorNotice onRetry={() => void list.refetch()} />
        ) : !list.data ? (
          <div className="kore-apply-template__loading">
            <Spinner label={t('templates.loading')} />
          </div>
        ) : list.data.length === 0 ? (
          <div className="kore-apply-template__empty">
            <p className="kore-apply-template__empty-text">{t('templates.apply.empty')}</p>
            <Button
              type="button"
              onClick={() =>
                window.open(`${paths.plannerTemplates}${TAB_QUERY[kind]}`, '_blank', 'noopener')
              }
            >
              {t('templates.apply.create')}
            </Button>
          </div>
        ) : (
          <ul className="kore-apply-template__list">
            {list.data.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="kore-apply-template__item"
                  onClick={() => {
                    setOpen(false);
                    setChosen(template);
                  }}
                >
                  <span className="kore-apply-template__name">{template.name}</span>
                  {kind === 'section_content' && (
                    <span className="kore-apply-template__preview">{textOf(template)}</span>
                  )}
                  {kind === 'appearance' && <AppearanceSample template={template} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <Dialog
        open={chosen !== null}
        onOpenChange={(next) => {
          if (!next) setChosen(null);
        }}
        title={t('templates.apply.confirmTitle', { name: chosen?.name ?? '' })}
        description={t(`templates.apply.confirm.${kind}`, { section: sectionLabel ?? '' })}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setChosen(null)}>
              {t('templates.apply.cancel')}
            </Button>
            <Button type="button" onClick={apply}>
              {t('templates.apply.confirmButton')}
            </Button>
          </>
        }
      />
    </div>
  );
}

/**
 * O Aplicar modelo de uma seção de Textos (RN07, RN08): troca só o texto, com os marcadores
 * pelos dados do casal; o título, as fotos e o Switch ficam (decisão 223, D17).
 */
export function TextTemplateAction({
  site,
  sectionType,
  onText,
}: {
  site: SiteEditorResponse;
  sectionType: TextSection;
  onText: (text: string) => void;
}) {
  const { t } = useTranslation('planner');
  if (!useCanApplyTemplates()) return null;
  return (
    <ApplyTemplate
      kind="section_content"
      sectionType={sectionType}
      sectionLabel={t(`templates.sections.${sectionType}`)}
      onApply={(template) => {
        const result = applyMarkers({
          text: textOf(template),
          data: {
            partnerNames: site.partners.map((partner) => partner.name),
            eventDate: site.eventDate,
            city: site.city,
          },
        });
        onText(result.text);
        return { missingDate: result.missingDate };
      }}
    />
  );
}

/** O Aplicar modelo do FAQ (RN08): troca a lista de perguntas; o título e o Switch ficam. */
export function FaqTemplateAction({
  onQuestions,
}: {
  onQuestions: (questions: FaqQuestion[]) => void;
}) {
  if (!useCanApplyTemplates()) return null;
  return (
    <ApplyTemplate
      kind="faq"
      onApply={(template) => {
        onQuestions(questionsOf(template));
        return {};
      }}
    />
  );
}

/** O rascunho da Aparência a partir do `content` de um modelo (RN08; RN09 no Novo casamento). */
export function appearanceDraftOf(template: PlannerTemplateResponse): AppearanceDraft {
  const content = appearanceOf(template);
  return draftFrom({ ...content, starterPaletteKey: content.starterPaletteKey ?? null });
}

/**
 * O Aplicar modelo da Aparência (RN08): troca o par de fontes, as cores, o fundo e a paleta
 * de partida no rascunho; a prévia acompanha, e nada vai ao ar até Salvar.
 */
export function AppearanceTemplateAction({
  onAppearance,
}: {
  onAppearance: (draft: AppearanceDraft) => void;
}) {
  if (!useCanApplyTemplates()) return null;
  return (
    <ApplyTemplate
      kind="appearance"
      onApply={(template) => {
        onAppearance(appearanceDraftOf(template));
        return {};
      }}
    />
  );
}

/**
 * O Começar de um modelo do passo 2 do Novo casamento (RN09): um Select com os modelos de
 * Aparência; escolher preenche a Aparência e a prévia, sem confirmação (nada foi gravado
 * ainda). Sem modelos de Aparência, o Select não aparece. Os textos são da decisão 298: a
 * opção "Sem modelo" de partida e cada modelo só pelo nome, na ordem da API (do mais novo).
 */
export function StartFromTemplate({
  defaultAppearance,
  onAppearance,
}: {
  /** A Aparência padrão do passo 2, que o "Sem modelo" devolve (decisão 299). */
  defaultAppearance: AppearanceDraft;
  onAppearance: (draft: AppearanceDraft) => void;
}) {
  const { t } = useTranslation('planner');
  const [chosen, setChosen] = useState('');
  const list = usePlannerTemplatesControllerListV1({ kind: 'appearance' });
  if (!list.data || list.data.length === 0) return null;
  const templates = list.data;
  return (
    <FormField
      label={t('newWedding.template')}
      optionalText={t('newWedding.optional')}
      hint={t('newWedding.templateHint')}
    >
      {({ id, describedBy }) => (
        <Select
          id={id}
          value={chosen}
          onChange={(event) => {
            setChosen(event.target.value);
            // Toda escolha preenche a Aparência; o "Sem modelo" devolve o padrão. Mudar a
            // Aparência à mão não mexe no Select: ele mostra o ponto de partida (decisão 299).
            const template = templates.find((item) => item.id === event.target.value);
            onAppearance(template ? appearanceDraftOf(template) : defaultAppearance);
          }}
          {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
        >
          <option value="">{t('newWedding.templateNone')}</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}

/** As ações de modelo da cerimonialista para o Editor (o ponto de extensão do `site`). */
export const PLANNER_TEMPLATE_ACTIONS: SectionTemplateActions = {
  Text: TextTemplateAction,
  Faq: FaqTemplateAction,
  Appearance: AppearanceTemplateAction,
};
