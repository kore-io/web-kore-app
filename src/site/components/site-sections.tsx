import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSectionResponse } from '../../shared/api/generated/model';
import { routeLinks, venueDateLine } from '../venue-format';
import { PhotoViewer } from './photo-viewer';
import { sectionAnchor } from './site-layout';
import { SiteText } from './site-text';

interface Image {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

const text = (content: Record<string, unknown> | undefined) =>
  typeof content?.text === 'string' ? content.text : '';

/**
 * As seções do Início (Seções RN05 a RN10; Penpot, Início), na ordem que a API manda, só
 * as ligadas e com conteúdo. A contagem fica no Hero. As seções alternam o fundo do site e
 * a superfície.
 */
export function SiteSections({ sections }: { sections: readonly PublicSectionResponse[] }) {
  const visible = sections.filter((section) => section.type !== 'countdown');
  return (
    <>
      {visible.map((section, index) => (
        <SiteSection key={section.type} section={section} tone={index % 2 === 0 ? 'base' : 'alt'} />
      ))}
    </>
  );
}

function SiteSection({ section, tone }: { section: PublicSectionResponse; tone: 'base' | 'alt' }) {
  const { t } = useTranslation('publicSite');
  const titleId = useId();
  const type = section.type;
  // Hospedagem sem sobretítulo (decisão 222); as outras com o do Penpot.
  const overline =
    type === 'story' || type === 'ceremony' || type === 'dress_code' || type === 'faq'
      ? t(`sections.overline.${type}`)
      : null;
  const title = section.title ?? '';
  return (
    <section
      id={sectionAnchor(type)}
      className={`kore-site-section kore-site-section--${tone} kore-site-section--${type}`}
      aria-labelledby={titleId}
    >
      <div
        className={
          type === 'story'
            ? 'kore-site-section__inner kore-site-section__inner--wide'
            : 'kore-site-section__inner'
        }
      >
        {type === 'story' ? (
          <Story section={section} titleId={titleId} overline={overline} />
        ) : (
          <>
            <Heading titleId={titleId} overline={overline} title={title} />
            {type === 'ceremony' && <Ceremony section={section} />}
            {type === 'lodging' && (
              <SiteText text={text(section.content)} className="kore-site-section__text" />
            )}
            {type === 'dress_code' && <DressCode section={section} />}
            {type === 'faq' && <Faq section={section} />}
          </>
        )}
      </div>
    </section>
  );
}

function Heading({
  titleId,
  overline,
  title,
  align = 'center',
}: {
  titleId: string;
  overline: ReactNode;
  title: string;
  align?: 'center' | 'start';
}) {
  return (
    <header className={`kore-site-section__header kore-site-section__header--${align}`}>
      {overline && <p className="kore-site-section__overline">{overline}</p>}
      <h2 id={titleId} className="kore-site-section__title">
        {title}
      </h2>
    </header>
  );
}

/** Nossa história (RN05): o texto e as fotos, que abrem no visualizador ao tocar. */
function Story({
  section,
  titleId,
  overline,
}: {
  section: PublicSectionResponse;
  titleId: string;
  overline: ReactNode;
}) {
  const { t } = useTranslation('publicSite');
  const [open, setOpen] = useState<number | null>(null);
  const title = section.title ?? '';
  const images = (Array.isArray(section.content?.images) ? section.content.images : []) as Image[];
  const photos = images.map((image, index) => ({
    url: image.url,
    thumbUrl: image.thumbUrl,
    alt: t('sections.storyAlt', { n: index + 1, total: images.length, title }),
  }));
  return (
    <div
      className={photos.length > 0 ? 'kore-site-story' : 'kore-site-story kore-site-story--text'}
    >
      {photos.length > 0 && (
        <ul
          className={
            photos.length === 1
              ? 'kore-site-story__photos kore-site-story__photos--one'
              : 'kore-site-story__photos'
          }
        >
          {photos.map((photo, index) => (
            <li key={photo.url}>
              <button
                type="button"
                className="kore-site-story__photo"
                onClick={() => setOpen(index)}
              >
                <img
                  className="kore-site-story__image"
                  src={photo.thumbUrl}
                  alt={photo.alt}
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="kore-site-story__body">
        <Heading titleId={titleId} overline={overline} title={title} align="start" />
        <SiteText text={text(section.content)} className="kore-site-section__text" />
      </div>
      <PhotoViewer
        photos={photos}
        index={open}
        onIndexChange={setOpen}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

interface Venue {
  title: string;
  placeName: string;
  date: string | null;
  time: string | null;
  address: string;
}

/**
 * Cerimônia & Recepção (RN07): para o visitante, o cartão fechado, sem local nem horário
 * (o servidor nem manda); para o grupo, os cartões dos locais com a data, a hora, o
 * endereço e os botões de rota, que abrem em nova aba.
 */
function Ceremony({ section }: { section: PublicSectionResponse }) {
  const { t } = useTranslation('publicSite');
  if (!section.locked) {
    const venues = (
      Array.isArray(section.content?.venues) ? section.content.venues : []
    ) as Venue[];
    return (
      <ul className="kore-site-venues">
        {venues.map((venue, index) => {
          const links = routeLinks(venue.address);
          const when = venueDateLine({ date: venue.date, time: venue.time });
          return (
            <li key={index} className="kore-site-venue">
              <p className="kore-site-venue__title">{venue.title}</p>
              <h3 className="kore-site-venue__place">{venue.placeName}</h3>
              {when && <p className="kore-site-venue__when">{when}</p>}
              <p className="kore-site-venue__address">{venue.address}</p>
              <p className="kore-site-venue__routes">
                <a
                  className="kore-site-venue__route"
                  href={links.googleMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('sections.venue.googleMaps')}{' '}
                  <span className="kore-site-venue__new-tab">{t('sections.venue.newTab')}</span>
                </a>
                <a
                  className="kore-site-venue__route"
                  href={links.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('sections.venue.waze')}{' '}
                  <span className="kore-site-venue__new-tab">{t('sections.venue.newTab')}</span>
                </a>
              </p>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="kore-site-card kore-site-card--locked">
      <Info className="kore-site-card__icon" aria-hidden="true" />
      <p className="kore-site-card__text">{t('sections.ceremonyLocked')}</p>
      <p className="kore-site-card__hint">{t('sections.ceremonyLockedHint')}</p>
    </div>
  );
}

/** Dress code (RN09): o texto e a foto de referência, quando houver. */
function DressCode({ section }: { section: PublicSectionResponse }) {
  const { t } = useTranslation('publicSite');
  const image = section.content?.image as Image | null | undefined;
  return (
    <>
      <SiteText text={text(section.content)} className="kore-site-section__text" />
      {image && (
        <img
          className="kore-site-dress__image"
          src={image.url}
          alt={t('sections.dressCodeAlt')}
          loading="lazy"
        />
      )}
    </>
  );
}

/** FAQ (RN10): sanfona; as perguntas começam fechadas e cada uma abre e fecha sozinha. */
function Faq({ section }: { section: PublicSectionResponse }) {
  const items = (Array.isArray(section.content?.items) ? section.content.items : []) as {
    question: string;
    answer: string;
  }[];
  return (
    <ul className="kore-site-faq">
      {items.map((item, index) => (
        <FaqItem key={index} question={item.question} answer={item.answer} />
      ))}
    </ul>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <li className="kore-site-faq__item">
      <h3 className="kore-site-faq__question">
        <button
          type="button"
          className="kore-site-faq__button"
          aria-expanded={open}
          aria-controls={answerId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{question}</span>
          <Icon className="kore-site-faq__icon" aria-hidden="true" />
        </button>
      </h3>
      <div id={answerId} className="kore-site-faq__answer" hidden={!open}>
        <SiteText text={answer} />
      </div>
    </li>
  );
}
