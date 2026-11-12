import { Button, Dialog, PageHeader, Select, Spinner, Tab, Tabs } from '@kore-io/design';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useBlocker, useNavigate, useParams } from 'react-router';
import { siteSectionPath } from '../../../app/paths';
import { useSiteControllerGetV1 } from '../../../shared/api/generated/site/site';
import { LoadErrorNotice } from '../../../shared/components/load-error';
import { useActiveWedding, type Audience } from '../../guests/hooks/use-active-wedding';
import { BasicsSection } from '../components/basics-section';
import { SitePreview } from '../components/site-preview';
import { SectionFormProvider, type SectionForm } from '../section-form';
import {
  EDITOR_SECTIONS,
  FIRST_SECTION_SLUG,
  sectionBySlug,
  sectionState,
  type SectionKey,
} from '../sections';
import { savedAtText, siteStatus } from '../site-texts';

type MobileTab = 'sections' | 'edit' | 'preview';

/** Site › Editor (Dados básicos RN01, RN10, RN11; decisão 214). */
export function SiteEditorPage() {
  const { weddingId, audience } = useActiveWedding();
  const { section: slug } = useParams();
  const section = sectionBySlug(slug);
  if (!section) return <Navigate to={siteSectionPath({ section: FIRST_SECTION_SLUG })} replace />;
  if (!weddingId) return null;
  return <SiteEditor weddingId={weddingId} sectionKey={section.key} audience={audience} />;
}

function SiteEditor({
  weddingId,
  sectionKey,
  audience,
}: {
  weddingId: string;
  sectionKey: SectionKey;
  audience: Audience;
}) {
  const { t } = useTranslation('site');
  const navigate = useNavigate();
  const site = useSiteControllerGetV1(weddingId);
  const [form, setForm] = useState<SectionForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MobileTab>('edit');
  const dirty = form?.dirty === true;

  // Trocar de seção (ou sair do Editor) com mudança pede o Dialog (Dados básicos RN10).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  // Fechar a aba com mudança: o aviso do navegador, sem texto do Kore (textos-f2).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const register = useCallback((next: SectionForm | null) => setForm(next), []);

  if (site.isError) return <LoadErrorNotice onRetry={() => void site.refetch()} />;
  if (!site.data) {
    return (
      <div className="kore-site-editor__loading">
        <Spinner label={t('loading')} />
      </div>
    );
  }
  const data = site.data;
  const status = siteStatus(data.status);
  const sectionName = (key: SectionKey) => {
    const found = data.sections.find((item) => item.type === key);
    return found?.title ?? t(`sections.names.${key}`);
  };
  const subtitle = [
    data.slug && t('address', { slug: data.slug }),
    status && t(`status.${status}`),
    savedAtText({ t, at: data.siteUpdatedAt, timezone: data.timezone }),
  ]
    .filter(Boolean)
    .join(' · ');

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await form.save();
    } finally {
      setSaving(false);
    }
  }

  const list = (
    <nav className="kore-site-editor__list" aria-label={t('sections.title')}>
      <h2 className="kore-site-editor__list-title">{t('sections.title')}</h2>
      <ul>
        {EDITOR_SECTIONS.map(({ key, slug }) => (
          <li key={key}>
            <Link
              to={siteSectionPath({ section: slug })}
              className="kore-site-editor__item"
              aria-current={key === sectionKey ? 'page' : undefined}
              onClick={() => setTab('edit')}
            >
              <span>{t(`sections.names.${key}`)}</span>
              <span className="kore-site-editor__state">
                {t(`sections.state.${sectionState({ key, sections: data.sections })}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="kore-site-editor">
      <PageHeader
        title={t('title')}
        description={subtitle}
        actions={
          <Button
            disabled={!dirty || form?.canSave === false || saving}
            onClick={() => void save()}
          >
            {t('save')}
          </Button>
        }
      />

      <div className="kore-site-editor__tabs">
        <Tabs aria-label={t('tabs.label')}>
          {(['sections', 'edit', 'preview'] as const).map((value) => (
            <Tab key={value} asChild current={tab === value}>
              <button type="button" onClick={() => setTab(value)}>
                {t(`tabs.${value}`)}
              </button>
            </Tab>
          ))}
        </Tabs>
      </div>

      <div className="kore-site-editor__body" data-tab={tab}>
        <div className="kore-site-editor__list-column">{list}</div>
        <div className="kore-site-editor__form-column">
          <div className="kore-site-editor__select">
            <Select
              aria-label={t('sections.select')}
              value={sectionKey}
              onChange={(event) => {
                const next = EDITOR_SECTIONS.find((item) => item.key === event.target.value);
                if (next) void navigate(siteSectionPath({ section: next.slug }));
              }}
            >
              {EDITOR_SECTIONS.map(({ key }) => (
                <option key={key} value={key}>
                  {t('sections.option', { name: t(`sections.names.${key}`) })}
                </option>
              ))}
            </Select>
          </div>
          <SectionFormProvider onChange={register}>
            <section className="kore-site-editor__panel" aria-labelledby="kore-site-section-title">
              <h2 id="kore-site-section-title" className="kore-site-editor__panel-title">
                {t(`sections.names.${sectionKey}`)}
              </h2>
              {sectionKey === 'basics' && (
                <BasicsSection
                  // O que cada um pode mudar e a publicação mudam os campos: a seção remonta.
                  key={`${data.publishedAt ?? ''}:${JSON.stringify(data.editable)}`}
                  weddingId={weddingId}
                  site={data}
                  audience={audience}
                />
              )}
            </section>
          </SectionFormProvider>
        </div>
        <div className="kore-site-editor__preview-column">
          <SitePreview site={data} />
        </div>
      </div>

      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title={t('discard.title')}
        description={t('discard.description', { section: sectionName(sectionKey) })}
        stackActions
        actions={
          <>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              {t('discard.keep')}
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              {t('discard.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
