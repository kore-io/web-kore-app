import {
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  Spinner,
  Tab,
  Tabs,
  useToast,
} from '@kore-io/design';
import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { paths } from '../../../app/paths';
import type { PlannerTemplateResponse } from '../../../shared/api/generated/model';
import {
  getPlannerTemplatesControllerListV1QueryKey,
  usePlannerTemplatesControllerListV1,
  usePlannerTemplatesControllerRemoveV1,
} from '../../../shared/api/generated/planner/planner';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { TemplateFormDialog } from './template-form-dialog';
import { TemplatesList } from './templates-list';
import { KIND_BY_TAB, TEMPLATE_TABS, type TemplateTab } from './templates-model';

const TAB_PARAM = 'aba';
/** A aba na URL: Textos é a padrão, sem parâmetro. */
const TAB_SLUG: Record<TemplateTab, string | null> = {
  texts: null,
  faq: 'faq',
  appearance: 'aparencia',
};

function tabFrom(value: string | null): TemplateTab {
  return TEMPLATE_TABS.find((tab) => TAB_SLUG[tab] === value) ?? 'texts';
}

function tabPath(tab: TemplateTab): string {
  const slug = TAB_SLUG[tab];
  return slug ? `${paths.plannerTemplates}?${TAB_PARAM}=${slug}` : paths.plannerTemplates;
}

type Editing = { mode: 'create' } | { mode: 'edit'; template: PlannerTemplateResponse };

/**
 * Modelos (`/cerimonialista/modelos`; Modelos do cerimonialista RN01 a RN06; Voz, Modelos do
 * cerimonialista): as abas Textos · FAQ · Aparência, a lista do mais novo para o mais
 * antigo, os vazios por aba, o Criar e o Editar em Dialog e o Excluir com confirmação.
 */
export function TemplatesPage() {
  const { t } = useTranslation('planner');
  const [searchParams] = useSearchParams();
  const tab = tabFrom(searchParams.get(TAB_PARAM));
  const list = usePlannerTemplatesControllerListV1({ kind: KIND_BY_TAB[tab] });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<PlannerTemplateResponse | null>(null);

  const create = (
    <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
      {t('templates.create')}
    </Button>
  );

  return (
    <div className="kore-templates">
      <PageHeader
        title={t('templates.title')}
        description={t('templates.description')}
        actions={create}
      />
      <Tabs aria-label={t('templates.tabsLabel')}>
        {TEMPLATE_TABS.map((key) => (
          <Tab key={key} asChild current={key === tab}>
            <Link to={tabPath(key)}>{t(`templates.tabs.${key}`)}</Link>
          </Tab>
        ))}
      </Tabs>
      {list.isError ? (
        <LoadErrorNotice onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="kore-templates__loading">
          <Spinner label={t('templates.loading')} />
        </div>
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={t(`templates.empty.${tab}.title`)}
          description={t(`templates.empty.${tab}.description`)}
          action={
            <Button type="button" onClick={() => setEditing({ mode: 'create' })}>
              {t('templates.create')}
            </Button>
          }
        />
      ) : (
        <TemplatesList
          tab={tab}
          templates={list.data}
          onEdit={(template) => setEditing({ mode: 'edit', template })}
          onDelete={setDeleting}
        />
      )}
      {editing && (
        <TemplateFormDialog
          tab={tab}
          template={editing.mode === 'edit' ? editing.template : null}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteTemplateDialog template={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** Excluir com confirmação (RN06): os sites em que ela já aplicou não mudam. */
function DeleteTemplateDialog({
  template,
  onClose,
}: {
  template: PlannerTemplateResponse | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tAccess } = useTranslation('access');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const remove = usePlannerTemplatesControllerRemoveV1();

  function confirm() {
    if (!template) return;
    remove.mutate(
      { id: template.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getPlannerTemplatesControllerListV1QueryKey(),
          });
          showToast({ tone: 'success', message: t('templates.toast.deleted') });
          onClose();
        },
        onError: () => {
          showToast({
            tone: 'danger',
            message: `${tAccess('alerts.generic.title')}. ${tAccess('alerts.generic.description')}`,
          });
        },
      },
    );
  }

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('templates.deleteDialog.title', { name: template?.name ?? '' })}
      description={t('templates.deleteDialog.description')}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('templates.deleteDialog.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            aria-busy={remove.isPending || undefined}
            onClick={confirm}
          >
            {t('templates.deleteDialog.confirm')}
          </Button>
        </>
      }
    />
  );
}
