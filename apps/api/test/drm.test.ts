import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VdoCipherProvider } from '../src/core/drm';
import { createStoreWithProduct, TestApp } from './harness';

describe('VdoCipher adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(reply: unknown, status = 200) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(reply), { status });
    }));
    return calls;
  }

  it('asks for upload credentials and hands the browser the S3 form fields', async () => {
    const calls = stub({
      videoId: 'v123',
      clientPayload: {
        policy: 'P', key: 'K', 'x-amz-signature': 'S', 'x-amz-algorithm': 'A', 'x-amz-date': 'D', 'x-amz-credential': 'C',
        uploadLink: 'https://vdo-bucket.s3-accelerate.amazonaws.com',
      },
    });
    const up = await new VdoCipherProvider('secret-1').createUpload('Lesson 1');
    expect(calls[0]!.url).toBe('https://dev.vdocipher.com/api/videos?title=Lesson+1&folderId=root');
    expect(calls[0]!.init.method).toBe('PUT');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Apisecret secret-1');
    expect(up).toEqual({
      videoId: 'v123', uploadUrl: 'https://vdo-bucket.s3-accelerate.amazonaws.com',
      fields: {
        key: 'K', policy: 'P', 'x-amz-signature': 'S', 'x-amz-algorithm': 'A', 'x-amz-date': 'D', 'x-amz-credential': 'C',
        success_action_status: '201', success_action_redirect: '',
      },
    });
  });

  it('maps statuses and builds the player address from a five-minute OTP with the watermark', async () => {
    const p = new VdoCipherProvider('s');
    stub({ status: 'Pre-Upload' });
    expect((await p.status('v')).status).toBe('uploading');
    stub({ status: 'Queued' });
    expect((await p.status('v')).status).toBe('processing');
    stub({ status: 'ready', length: 25 });
    expect(await p.status('v')).toEqual({ status: 'ready', durationSec: 25 });

    const calls = stub({ otp: 'O1', playbackInfo: 'PB1' });
    const play = await p.playback('v9', '@ali · 123456');
    expect(calls[0]!.url).toBe('https://dev.vdocipher.com/api/videos/v9/otp');
    const body = JSON.parse(calls[0]!.init.body as string) as { ttl: number; annotate: string };
    expect(body.ttl).toBe(300);
    expect(JSON.parse(body.annotate)[0]).toMatchObject({ type: 'rtext', text: '@ali · 123456' });
    expect(play.playerUrl).toBe('https://player.vdocipher.com/v2/?otp=O1&playbackInfo=PB1');
  });

  it('turns a provider failure into DRM_PROVIDER_ERROR', async () => {
    stub({ message: 'bad key' }, 401);
    await expect(new VdoCipherProvider('s').status('v')).rejects.toMatchObject({ code: 'DRM_PROVIDER_ERROR' });
  });
});

describe('DRM lessons and VIP posts (fake provider)', () => {
  const t = new TestApp();
  beforeAll(() => t.start());
  afterAll(() => t.stop());

  it('plays DRM video only for buyers, through a fresh player address, with no plain stream', async () => {
    expect((await t.http.get('/v1/drm/config').expect(200)).body.enabled).toBe(true);
    const creator = await t.signUp(['create']);
    const student = await t.signUp(['discover']);
    const stranger = await t.signUp(['create']);
    const { product, variantId } = await createStoreWithProduct(t, creator, { type: 'COURSE', priceMinor: '2000' });
    const course = (await creator.agent.post('/v1/creator/courses').send({ title: 'Swing', summary: 'Slow', productId: product.id }).expect(201)).body;
    const section = (await creator.agent.post(`/v1/creator/courses/${course.id}/sections`).send({ title: 'One' }).expect(201)).body;
    const lesson = (await creator.agent.post(`/v1/creator/sections/${section.id}/lessons`).send({ title: 'Trend', isPreview: true }).expect(201)).body;

    // Buyers cannot upload; creators get a one-time upload address from the provider.
    await student.agent.post('/v1/drm/videos').send({ title: 'x' }).expect(403);
    const up = (await creator.agent.post('/v1/drm/videos').send({ title: 'Trend.mp4' }).expect(201)).body;
    expect(up.id).toMatch(/^fake_/);
    expect(up.uploadUrl).toBeTruthy();
    await stranger.agent.put(`/v1/creator/lessons/${lesson.id}/drm-video`).send({ videoId: up.id }).expect(404);
    const foreignVideo = (await stranger.agent.post('/v1/drm/videos').send({ title: 'mine' }).expect(201)).body;
    await creator.agent.put(`/v1/creator/lessons/${lesson.id}/drm-video`).send({ videoId: foreignVideo.id }).expect(404);

    const set = (await creator.agent.put(`/v1/creator/lessons/${lesson.id}/drm-video`).send({ videoId: up.id }).expect(200)).body;
    expect(set).toMatchObject({ drm: true, status: 'ready' });
    await creator.agent.post(`/v1/creator/courses/${course.id}/published`).send({ published: true }).expect(200);

    // A DRM video is paid by nature, even on a lesson that was a free preview.
    const outline = (await t.http.get(`/v1/courses/${course.slug}`).expect(200)).body;
    expect(outline.sections[0].lessons[0]).toMatchObject({ hasVideo: true, drm: true, locked: true, isPreview: false });
    await t.http.get(`/v1/lessons/${lesson.id}/playback`).expect(401);
    await student.agent.get(`/v1/lessons/${lesson.id}/playback`).expect(403);
    // There is no plain stream to fall back to.
    await creator.agent.get(`/v1/lessons/${lesson.id}/stream`).set({ 'Sec-Fetch-Dest': 'video' }).expect(404);

    await student.agent.post('/v1/cart/items').send({ variantId, quantity: 1 }).expect(201);
    const c = (await student.agent.post('/v1/checkout').send({ idempotencyKey: t.unique('attempt') }).expect(201)).body;
    await student.agent.post(`/v1/payments/${c.payment.paymentId}/simulate`).send({ outcome: 'success' }).expect(200);
    const play = (await student.agent.get(`/v1/lessons/${lesson.id}/playback`).expect(200)).body;
    expect(play.status).toBe('ready');
    expect(play.playerUrl).toContain(`fake-drm=${up.id}`);
    // The watermark names the viewer by username and id, never by email.
    const mark = decodeURIComponent(play.playerUrl.split('wm=')[1]);
    expect(mark).toContain(student.id.slice(-6));
    expect(mark).not.toContain(student.email);
    expect((await creator.agent.get(`/v1/drm/videos/${up.id}`).expect(200)).body.status).toBe('ready');
    await stranger.agent.get(`/v1/drm/videos/${up.id}`).expect(404);

    // Replacing with a plain upload, or removing, clears the DRM video.
    await creator.agent.delete(`/v1/creator/lessons/${lesson.id}/video`).expect(200);
    await student.agent.get(`/v1/lessons/${lesson.id}/playback`).expect(404);
  });

  it('streams DRM video in VIP posts to members only', async () => {
    const owner = await t.signUp(['create']);
    const member = await t.signUp(['discover']);
    const outsider = await t.signUp(['discover']);
    const vip = (await owner.agent.post('/v1/communities').send({ name: t.unique('VIP DRM'), description: 'Members', visibility: 'PRIVATE' }).expect(201)).body;
    await t.db.communityMember.create({ data: { communityId: vip.id, userId: member.id } });
    const up = (await owner.agent.post('/v1/drm/videos').send({ title: 'Setup.mp4' }).expect(201)).body;
    const post = (await owner.agent.post(`/v1/communities/${vip.slug}/posts`).send({ title: 'Setup', body: 'Watch', drmVideoId: up.id }).expect(201)).body;
    expect(post).toMatchObject({ hasVideo: true, drm: true });

    const view = (await member.agent.get(`/v1/communities/${vip.slug}`).expect(200)).body;
    expect(view.posts[0]).toMatchObject({ hasVideo: true, drm: true });
    expect(JSON.stringify(view)).not.toContain(up.id);
    expect((await member.agent.get(`/v1/posts/${post.id}/playback`).expect(200)).body.playerUrl).toContain('fake-drm=');
    await outsider.agent.get(`/v1/posts/${post.id}/playback`).expect(403);
    await t.http.get(`/v1/posts/${post.id}/playback`).expect(401);
  });
});
