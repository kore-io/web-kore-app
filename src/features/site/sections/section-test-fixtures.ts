import { meFor } from '../../../../tests/profile';
import { apiError, mockApi } from '../../../../tests/render-route';
import type { SiteEditorResponse, SiteSectionResponse } from '../../../shared/api/generated/model';

/** Os dados de teste das seções do Editor: o /me, o site e o PUT de cada seção. */
export const me = {
  user: {
    id: 'u1',
    name: 'Ana Beatriz Moreira',
    email: 'ana.moreira@gmail.com',
    platformRole: 'none',
  },
  activeProfile: 'couple',
  authenticatedAt: '2026-11-05T12:00:00Z',
  memberships: [
    {
      weddingId: 'w1',
      role: 'owner',
      weddingName: 'Ana & Marcos',
      eventDate: '2026-11-14',
      city: 'Campinas',
      state: 'SP',
    },
  ],
  profiles: ['couple'],
  lastProfileOnDevice: 'couple',
  planner: null,
  referrer: null,
};

export const baseSections: SiteSectionResponse[] = [
  {
    type: 'story',
    title: 'Nossa história',
    content: { text: '', images: [] },
    enabled: false,
    empty: true,
  },
  { type: 'countdown', title: null, content: {}, enabled: true, empty: false },
  {
    type: 'ceremony',
    title: 'Cerimônia & Recepção',
    content: { venues: [] },
    enabled: true,
    empty: true,
  },
  {
    type: 'lodging',
    title: 'Hospedagem e transporte',
    content: { text: '' },
    enabled: false,
    empty: true,
  },
  {
    type: 'dress_code',
    title: 'Dress code',
    content: { text: '', image: null },
    enabled: false,
    empty: true,
  },
  {
    type: 'faq',
    title: 'Perguntas frequentes',
    content: { items: [] },
    enabled: false,
    empty: true,
  },
];

export function siteWith({
  sections = baseSections,
  eventDate = '2026-11-14',
  editable = { names: true, eventDate: true, state: true, slug: true },
}: {
  sections?: SiteSectionResponse[];
  eventDate?: string | null;
  editable?: Record<string, boolean>;
} = {}) {
  return {
    publishedAt: null,
    siteUpdatedAt: '2026-11-11T13:31:00Z',
    partners: [
      { id: 'pa', title: 'bride', name: 'Ana Beatriz Moreira' },
      { id: 'pm', title: 'groom', name: 'Marcos Vinícius Rocha' },
    ],
    eventDate,
    city: 'Campinas',
    state: 'SP',
    timezone: 'America/Sao_Paulo',
    slug: 'ana-e-marcos',
    contactWhatsapp: null,
    contactEmail: null,
    cover: null,
    appearance: {
      starterPaletteKey: 'terracota',
      fontPairKey: 'romantico',
      primaryColor: '#A94F37',
      accentColor: '#7A8B69',
      backgroundMode: 'cream',
    },
    sections,
    editable,
    status: 'draft',
  } as unknown as SiteEditorResponse;
}

export const withSection = (section: SiteSectionResponse) =>
  baseSections.map((item) => (item.type === section.type ? section : item));

export type Call = { method: string; path: string; body: Record<string, unknown> };

export function mockSite({
  site = siteWith(),
  put,
}: {
  site?: SiteEditorResponse;
  put?: (type: string, body: Record<string, unknown>) => Response;
} = {}) {
  const calls: Call[] = [];
  let uploads = 0;
  mockApi(({ method, path, body }) => {
    if (path === '/v1/me') return Response.json(meFor(me));
    if (path === '/v1/weddings/w1/site' && method === 'GET') return Response.json(site);
    // O envio de fotos (Imagens RN04): cada autorização ganha um id novo, e a confirmação
    // devolve a foto pronta com esse id.
    if (path === '/v1/weddings/w1/site-images/upload-authorizations') {
      uploads += 1;
      return Response.json(
        {
          imageId: `new${uploads}`,
          uploadUrl: `http://s3/put/new${uploads}`,
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1' },
          expiresAt: '2026-11-11T12:05:00Z',
        },
        { status: 201 },
      );
    }
    if (path === '/v1/weddings/w1/site-images') {
      const { imageId } = body as { imageId: string };
      return Response.json({
        id: imageId,
        status: 'ready',
        url: `https://cdn/${imageId}/display.jpg`,
        thumbUrl: `https://cdn/${imageId}/thumb.jpg`,
        width: 2560,
        height: 1707,
      });
    }
    const match = /^\/v1\/weddings\/w1\/site\/sections\/(\w+)$/.exec(path);
    if (match && method === 'PUT') {
      const data = body as Record<string, unknown>;
      calls.push({ method, path, body: data });
      if (put) return put(match[1] ?? '', data);
      const content = data.content as Record<string, unknown>;
      const empty =
        match[1] === 'faq'
          ? (content.items as unknown[]).length === 0
          : !String(content.text ?? '').trim();
      // Como no GET do Editor, os ids viram as imagens (story) no retorno.
      const saved =
        match[1] === 'story'
          ? {
              text: content.text,
              images: (content.imageIds as string[]).map((id) => ({
                id,
                url: `https://cdn/${id}/display.jpg`,
                thumbUrl: `https://cdn/${id}/thumb.jpg`,
                width: 2560,
                height: 1707,
              })),
            }
          : content;
      return Response.json({ type: match[1], ...data, content: saved, empty });
    }
    return apiError({ status: 404, body: { error: 'NOT_FOUND' } });
  });
  return calls;
}
